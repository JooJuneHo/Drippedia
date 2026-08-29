package com.drippedia.auth;

import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * CSRF 토큰을 값으로 내려준다.
 * 프론트(vercel.app)와 백엔드(onrender.com)가 완전히 다른 도메인이라 프론트 JS가 XSRF-TOKEN 쿠키를
 * 읽을 수 없다(쿠키는 도메인별로 격리된다). 쿠키 자체는 브라우저가 요청에 같이 실어 보내므로,
 * 프론트는 헤더에 넣을 값만 알면 된다.
 * 읽을 수 있는 건 CORS가 허용한 오리진(우리 프론트)뿐이다.
 */
@RestController
public class CsrfController {

    @GetMapping("/api/csrf")
    public Map<String, String> csrf(CsrfToken token) {
        return Map.of("token", token.getToken());
    }
}
