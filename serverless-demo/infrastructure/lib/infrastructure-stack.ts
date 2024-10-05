import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.TableV2(this, 'demo-table', {
      tableName: 'serverless-demo-table',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
    });

    const restApi = new apigateway.RestApi(this, 'serverless-demo-api', {
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER,
    });

    const apiKey = new apigateway.ApiKey(this, 'serverless-demo-apiKey');
    const usagePlan = new apigateway.UsagePlan(this, 'demo-usage-plan', {
      name: 'Usage Plan',
      apiStages: [
        {
          stage: restApi.deploymentStage,
        },
      ],
    });
    usagePlan.addApiKey(apiKey);
        
    const handler = new lambda.Function(this, 'api-handler', {
      runtime: lambda.Runtime.JAVA_17,
      handler: "com.cmande50.app.APIHandler::handleRequest",
      code: lambda.Code.fromAsset("../software/serverless-demo/target/serverless-demo.jar"),
    });
    table.grantReadWriteData(handler);

    const helloResource = restApi.root.addResource('hello');
    const itemsResource = restApi.root.addResource('items');

    const helloIntegration = new apigateway.LambdaIntegration(handler);
    const itemsIntegration = new apigateway.LambdaIntegration(handler);

    helloResource.addMethod('GET', helloIntegration, {apiKeyRequired: true});
    itemsResource.addMethod('GET', itemsIntegration, {apiKeyRequired: true});
    itemsResource.addMethod('POST', itemsIntegration, {apiKeyRequired: true});

  }
}
