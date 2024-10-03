import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.TableV2(this, 'demo-table', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
    });

    const handler = new lambda.Function(this, 'api-handler', {
      runtime: lambda.Runtime.JAVA_17,
      handler: "com.cmande50.app.App::handleRequest",
      code: lambda.Code.fromAsset("../software/serverless-demo/target/serverless-demo.jar"),
    });
    table.grantReadWriteData(handler.grantPrincipal);

    const restApi = new apigateway.LambdaRestApi(this, 'serverless-demo', {
      handler: handler,
      proxy: false,
    });
        
    const helloResource = restApi.root.addResource('hello');
    helloResource.addMethod('GET');

  }
}
