package com.cmande50.app;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.google.gson.Gson;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;
import software.amazon.awssdk.services.dynamodb.model.ScanRequest;
import software.amazon.awssdk.services.dynamodb.model.ScanResponse;


/**
 * Lambda function entry point. You can change to use other pojo type or implement
 * a different RequestHandler.
 *
 * @see <a href=https://docs.aws.amazon.com/lambda/latest/dg/java-handler.html>Lambda Java Handler</a> for more information
 */
public class APIHandler implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
    private final DynamoDbClient  dynamoDbClient;
    private LambdaLogger logger;

    public APIHandler() {
        
        // Initialize the SDK client outside of the handler method so that it can be reused for subsequent invocations.
        // It is initialized when the class is loaded.
        dynamoDbClient = DependencyFactory.dynamoDbClient();
        // Consider invoking a simple api here to pre-warm up the application, eg: dynamodb#listTables
    }

    @Override
    public APIGatewayProxyResponseEvent  handleRequest(APIGatewayProxyRequestEvent event, Context context) {
        this.logger = context.getLogger();
        logger.log(event.toString());

        String resource = event.getResource().toLowerCase();
        logger.log("Resource: " + resource);

        if (resource.equals("/hello")) {
            return helloHandler(event);
        } else if (resource.equals("/items")) {
            return itemsHandler(event);
        }

        return unexpectedPathOrMethod();

        

    }

    private APIGatewayProxyResponseEvent helloHandler(APIGatewayProxyRequestEvent event) {
        APIGatewayProxyResponseEvent  response = new APIGatewayProxyResponseEvent ();

        HashMap<String, String> headers = new HashMap<String, String>();
        headers.put("Content-Type", "text/html");

        response.setHeaders(headers);
        response.setIsBase64Encoded(false);
        response.setStatusCode(200);
        response.setBody("Hello World");

        return response;
    }

    private APIGatewayProxyResponseEvent itemsHandler(APIGatewayProxyRequestEvent event) {
        APIGatewayProxyResponseEvent  response = new APIGatewayProxyResponseEvent ();

        HashMap<String, String> headers = new HashMap<String, String>();
        headers.put("Content-Type", "application/json");

        response.setHeaders(headers);
        response.setIsBase64Encoded(false);


        if (event.getHttpMethod().equals("GET")) {

            ScanRequest scanRequest = ScanRequest.builder()
                .tableName("serverless-demo-table")
                .build();

            try {
                ScanResponse scanResponse = dynamoDbClient.scan(scanRequest);
                List<Map<String, AttributeValue>> items = scanResponse.items();
                String jsonResponse = new Gson().toJson(items);

                response.setBody(jsonResponse);
                response.setStatusCode(200);
                
                

            } catch (DynamoDbException e) {
                logger.log(e.toString());
                response.setStatusCode(500);
                response.setBody("{\"error\": \"Internal Server Error\"}");
            } 

            
            return response;
        } else if (event.getHttpMethod().equals("POST")) {

            return response;
        }

        return unexpectedPathOrMethod();
    }

    private APIGatewayProxyResponseEvent unexpectedPathOrMethod() {
        logger.log("Unexpected Path or Method");

        APIGatewayProxyResponseEvent  response = new APIGatewayProxyResponseEvent ();

        HashMap<String, String> headers = new HashMap<String, String>();
        headers.put("Content-Type", "text/html");

        response.setHeaders(headers);
        response.setIsBase64Encoded(false);
        response.setStatusCode(200);
        response.setBody("Unexpected Path or Method");

        return response;
    }
}
