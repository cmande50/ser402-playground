import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const handler = new lambda.Function(this, 'api-handler', {
      runtime: lambda.Runtime.JAVA_17,
      handler: "com.cmande50.app.App::handleRequest",
      code: lambda.Code.fromAsset("../software/serverless-demo/target/serverless-demo.jar"),
    })

  }
}
