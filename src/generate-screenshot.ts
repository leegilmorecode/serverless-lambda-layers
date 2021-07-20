/* eslint-disable @typescript-eslint/no-var-requires */
import AWS from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import { APIGatewayProxyHandler, APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { config } from './shared/config';
import { Browser, Page } from 'puppeteer-core';
const chromium = require('chrome-aws-lambda');

let browser: Browser;
let page: Page;

interface S3Params {
  s3ForcePathStyle?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: AWS.Endpoint;
  region?: string;
}

// ensure if we are running serverless offline we use local s3 config
const s3Params: S3Params = config.isOffline
  ? {
      s3ForcePathStyle: true,
      accessKeyId: config.local.accessKeyId,
      secretAccessKey: config.local.secretAccessKey,
      endpoint: new AWS.Endpoint(config.local.endpoint),
    }
  : { region: config.region };

const s3 = new AWS.S3({ ...s3Params });

export const handler: APIGatewayProxyHandler = async ({ body }: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!config.bucketName) throw new Error('missing bucket config');
    if (!body) throw new Error('missing body'); // you would typically validate this with JSON schema but this is just a basic example

    const { webpage } = JSON.parse(body);

    if (!webpage) throw new Error('no webpage property on payload');

    // reuse the instance of the browser once it is created for improved cold starts
    if (!browser) {
      // launches a headless version of chromium puppeteer
      browser = await chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: config.isOffline ? undefined : await chromium.executablePath,
        headless: true,
        ignoreHTTPSErrors: true,
      });
    }

    if (!page) {
      page = await browser.newPage();
    }

    // uses the page object to go to the webpage from the payload
    await page.goto(webpage);
    const result = await page.screenshot(); // takes the screenshot of the page it is on

    if (!result) throw new Error(`no screenshot generated for webpage: ${webpage}`);

    const fileName = uuid();
    const fileNameWithExtension = `${fileName}.png`;

    await s3
      .putObject({
        Bucket: config.bucketName,
        Key: `${fileName}/${fileNameWithExtension}`,
        Body: result,
        ACL: 'public-read',
      })
      .promise();

    // generate a local s3 path if running serverless offline mode, otherwise an aws version from the cloud
    const returnPath = config.isOffline
      ? `http://localhost:4569/${config.bucketName}/${fileName}/${fileNameWithExtension}`
      : `https://${config.bucketName}.s3.${config.region}.amazonaws.com/${fileName}/${fileNameWithExtension}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        {
          message: returnPath,
        },
        null,
        2,
      ),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify('An error has been generated', null, 2),
    };
  }
};
