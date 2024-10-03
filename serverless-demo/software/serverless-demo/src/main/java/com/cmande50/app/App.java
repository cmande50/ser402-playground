package com.cmande50.app;

import java.util.HashMap;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import software.amazon.awssdk.services.dynamodb.DynamoDbAsyncClient;

/**
 * Lambda function entry point. You can change to use other pojo type or implement
 * a different RequestHandler.
 *
 * @see <a href=https://docs.aws.amazon.com/lambda/latest/dg/java-handler.html>Lambda Java Handler</a> for more information
 */
public class App implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {
    private final DynamoDbAsyncClient dynamoDbClient;
    private LambdaLogger logger;

    public App() {
        
        // Initialize the SDK client outside of the handler method so that it can be reused for subsequent invocations.
        // It is initialized when the class is loaded.
        dynamoDbClient = DependencyFactory.dynamoDbClient();
        // Consider invoking a simple api here to pre-warm up the application, eg: dynamodb#listTables
    }

    @Override
    public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent event, Context context) {
    this.logger = context.getLogger();
    logger.log("EVENT TYPE: " + event.getClass().toString());

    return handleHello();
  }

  private APIGatewayV2HTTPResponse handleHello() {
    APIGatewayV2HTTPResponse response = new APIGatewayV2HTTPResponse();

    HashMap<String, String> headers = new HashMap<String, String>();
    headers.put("Content-Type", "text/html");

    response.setHeaders(headers);
    response.setIsBase64Encoded(false);
    response.setStatusCode(200);
    response.setBody("Hello World");

    return response;
  }
}
