import { saveProviderCredential } from "../../vault/vault.repository.js";

const routeOptions = {
    schema:{
        body:{
            type: 'object',
            required: ['provider', 'secret'],
            properties: {
                provider:{ type: 'string', minLength: 1},
                secret: {type: 'string', minLength:1},
            },
        },
        response:{
            201:{
                type: 'object',
                properties:{
                    id:{ type: 'string'},
                    provider: {type: 'string'},
                    updated_at: {type: 'string'},
                },
            },
        },
    }
}

export async function credentialsRoutes(fastify, options) {
  fastify.post('/api/v1/credentials', routeOptions, async (request, reply) => {
    const {provider, secret} = request.body;
    const result = await saveProviderCredential(provider, secret);
    return reply.code(201).send(result);
  });
}