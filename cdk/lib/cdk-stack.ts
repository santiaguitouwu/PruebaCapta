import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class CdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const fn = new lambda.Function(this, 'WorkingDaysApi', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'lambda.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../dist')),
            memorySize: 512,
            timeout: cdk.Duration.seconds(10),
            environment: {
                HOLIDAYS_URL: 'https://content.capta.co/Recruitment/WorkingDays.json',
                HOLIDAYS_CACHE_TTL_MINUTES: '1440',
            },
        });

        const api = new apigateway.LambdaRestApi(this, 'ApiGateway', {
            handler: fn,
            proxy: true,
        });

        new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    }
}
