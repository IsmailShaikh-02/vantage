import { pool, query } from '../../config/db.js';
import { deprovisionQueue } from '../../queues/deprovision.queue.js';

const revokeRouteSchema = {
  schema: {
    headers: {
      type: 'object',
      required: ['idempotency-key'],
      properties: {
        'idempotency-key': { type: 'string', minLength: 1 },
      },
    },
    body: {
      type: 'object',
      required: ['work_email', 'target_providers'],
      properties: {
        work_email: { type: 'string', format: 'email' },
        target_providers: {
          type: 'array',
          items: { type: 'string', enum: ['slack', 'github'] },
          minItems: 1,
        },
      },
    },
  },
};

export async function remediationsRoutes(fastify, options) {
  fastify.post('/api/v1/remediations/revoke', revokeRouteSchema, async (request, reply) => {
    const idempotencyKey = request.headers['idempotency-key'];
    const { work_email, target_providers } = request.body;
    const initiatedBy = request.headers['x-actor'] || 'system_admin';

    // STEP 1: Query deprovision_jobs for existing idempotency_key
    
    const result = await query(
        `SELECT * FROM deprovision_jobs 
        WHERE idempotency_key=$1`,
        [idempotencyKey]
    )
    const deprov_data = result.rows[0]
    if(result.rows.length > 0){
        return reply.code(200).send({
            job_id: deprov_data.id,
            status: deprov_data.status,
            poll_url: `/api/v1/remediations/jobs/${deprov_data.id}`
        });
    }

    // STEP 2: Query employees for work_email

    const result2 = await query(
        `SELECT * FROM employees
        WHERE work_email = $1`,
        [work_email]
    )
    
    if(result2.rows.length === 0){
        return reply.code(404).send({
            error: "Employee not found"
        })
    }
    const employeeId = result2.rows[0].id

    // STEP 3: Begin PostgreSQL transaction with client
    let jobId;
    const client = await pool.connect();
    try{
        await client.query('Begin');

        const jobRes = await client.query(
            `INSERT INTO deprovision_jobs(employee_id, idempotency_key, status, initiated_by) 
            VALUES ($1,$2,$3,$4)
            RETURNING id
            `,[employeeId, idempotencyKey, 'in_progress', initiatedBy]
        );
        jobId = jobRes.rows[0].id;

        for (const provider of target_providers){
            await client.query(
                `INSERT INTO deprovision_tasks (job_id, provider, status) 
                VALUES ($1, $2, $3)`,[jobId, provider, 'pending']
            )
        }
        await client.query('COMMIT');
    }catch(err){
        await client.query('ROLLBACK');
        throw err;
    }finally{
        client.release();
    }

    // STEP 4: Enqueue job to deprovisionQueue 
    await deprovisionQueue.add(
      'execute-deprovision',
      {jobId, employeeId, target_providers},
      {jobId: idempotencyKey}
    )
    
    return reply.code(202).send({
      job_id:jobId,
      status: 'in_progress',
      target_employee: work_email,
      poll_url: `/api/v1/remediations/jobs/${jobId}`,
    })
  });
}