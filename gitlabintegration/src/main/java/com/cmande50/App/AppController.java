package com.cmande50.App;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/")
public class AppController {
 
    @GetMapping
    public ResponseEntity<String> hello() {

        String htmlResponse = "<html>" +
                "<body>" +
                "<h1>Hello from secure endpoint</h1>" +
                "</body>" +
                "</html>";
        return ResponseEntity.ok()
                .header("Content-Type", "text/html")
                .body(htmlResponse);
    }
}
