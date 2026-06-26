const { BigQuery } = require('@google-cloud/bigquery')

const serviceKey = process.env.GOOGLE_SERVICE_KEY

let BigqueryClient: any = null

if (serviceKey) {
  const credential = JSON.parse(
    Buffer.from(serviceKey, 'base64').toString().replace(/\n/g, ''),
  )

  BigqueryClient = new BigQuery({
    projectId: credential.project_id,
    credentials: {
      client_email: credential.client_email,
      private_key: credential.private_key,
    },
  })
}

export { BigqueryClient }
