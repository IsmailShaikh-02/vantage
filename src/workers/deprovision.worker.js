import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { DEPROVISION_QUEUE_NAME } from '../queues/deprovision.queue.js';
import { query } from '../config/db.js';
import { getDecryptedCredential } from '../vault/vault.repository.js';

export const deprovisionWorker = new Worker(
  DEPROVISION_QUEUE_NAME,
  async (job) => {
    const { jobId, employeeId, target_providers } = job.data;

    const sql = `
    SELECT provider, external_account_id 
    FROM employee_identities
    WHERE employee_id=$1
    `;
    const result = await query(sql, [employeeId]);

    for (const prov of target_providers){
      try {
        await query(`
          UPDATE deprovision_tasks
          SET status = 'running'
          WHERE job_id=$1 AND provider=$2
          `,[jobId, prov])

        const identity = result.rows.find((row) => row.provider === prov);

        if(!identity){
          await query(`
          UPDATE deprovision_tasks
          SET status = 'failed',
          error_log = 'Identity record not found for provider',
          completed_at = CURRENT_TIMESTAMP
          WHERE job_id=$1 AND provider=$2
          `,[jobId, prov])
          continue;
        }
        if(identity){
          const token = await getDecryptedCredential(prov)
        console.log('fetching api ',identity.external_account_id)

        await query(`
          UPDATE deprovision_tasks
          SET status = 'success',
          completed_at = CURRENT_TIMESTAMP
          WHERE job_id=$1 AND provider=$2`,[jobId, prov])
        }
      } catch (error) {
        await query(`
          UPDATE deprovision_tasks
          SET status = 'failed',
          error_log = $2,
          completed_at = CURRENT_TIMESTAMP
          WHERE job_id=$1 AND provider=$3
        `,[jobId,error.message, prov])
      }
    }
    const taskRes = await query(
      `SELECT status FROM deprovision_tasks WHERE job_id=$1`,[jobId]
    );
    const statuses = taskRes.rows.map((row)=> row.status)

    let finalJobStatus = 'partial_failure';

    if(statuses.every((s)=>s==='success')){
      finalJobStatus = 'completed';
    }else if(statuses.every((s)=>s==='failed')){
      finalJobStatus = 'failed';
    }

    await query(`
      UPDATE deprovision_jobs
      SET status=$1,
      completed_at=CURRENT_TIMESTAMP
      WHERE id=$2`,[finalJobStatus, jobId])
},
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 offboarding jobs concurrently
  }
);