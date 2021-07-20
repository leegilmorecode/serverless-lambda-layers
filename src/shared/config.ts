interface ConfigLocal {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
}

interface Config {
  region: string;
  isOffline: boolean;
  bucketName?: string;
  local: ConfigLocal;
}

export const config: Config = {
  region: process.env.REGION || 'eu-west-1',
  isOffline: process.env.IS_OFFLINE === 'true' ? true : false,
  bucketName: process.env.BUCKET_NAME,
  local: {
    accessKeyId: 'S3RVER',
    secretAccessKey: 'S3RVER',
    endpoint: 'http://localhost:4569',
  },
};
