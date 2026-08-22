package com.drippedia.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final OAuth2LoginService oAuth2LoginService;

    /** 프론트가 배포된 오리진. CORS 허용 대상이자 로그인/로그아웃 후 돌아갈 곳. */
    @Value("${app.frontend-url}")
    private String frontendUrl;

    /** XSRF-TOKEN 쿠키를 내려줄 도메인. 프론트/백이 서브도메인으로 갈릴 때만 채운다(예: .drippedia.com). */
    @Value("${app.cookie-domain:}")
    private String cookieDomain;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .authorizeHttpRequests(auth -> auth
                        // 레시피 구경은 로그인 없이도 가능, 쓰는 건 로그인 필요
                        .requestMatchers(HttpMethod.GET, "/api/recipes/**").permitAll()
                        .requestMatchers("/error", "/login/**", "/oauth2/**").permitAll()
                        .anyRequest().authenticated()
                )
                .csrf(csrf -> csrf
                        // 프론트 JS가 읽어야 하므로 httpOnly=false 쿠키로 내려준다
                        .csrfTokenRepository(csrfTokenRepository())
                        .csrfTokenRequestHandler(csrfTokenRequestHandler())
                )
                .oauth2Login(oauth2 -> oauth2
                        .userInfoEndpoint(userInfo -> userInfo.userService(oAuth2LoginService))
                        // 로그인은 백엔드 오리진에서 일어나므로 끝나면 프론트로 돌려보내야 한다
                        .defaultSuccessUrl(frontendUrl, true)
                )
                .logout(logout -> logout.logoutSuccessUrl(frontendUrl))
                // 로그인 안 된 API 호출은 로그인 페이지로 리다이렉트하지 말고 401을 준다
                .exceptionHandling(ex -> ex.defaultAuthenticationEntryPointFor(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                        request -> request.getRequestURI().startsWith("/api/")
                ))
                .build();
    }

    /**
     * 프론트가 다른 오리진이라 세션 쿠키를 실어 보내려면 allowCredentials=true가 필요하고,
     * 그러면 allowedOrigins에 와일드카드를 쓸 수 없어서 정확한 오리진 하나만 허용한다.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(frontendUrl));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    private CookieCsrfTokenRepository csrfTokenRepository() {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        if (!cookieDomain.isBlank()) {
            repository.setCookieCustomizer(cookie -> cookie.domain(cookieDomain));
        }
        return repository;
    }

    /**
     * 기본값은 토큰을 실제로 쓸 때까지 미뤄서(deferred) 첫 요청에 XSRF-TOKEN 쿠키가 안 생긴다.
     * attributeName을 null로 두면 매 요청 토큰을 로드해서 쿠키가 항상 내려간다.
     * ponytail: BREACH 대응(XOR 마스킹)은 포기한 설정. 서버 렌더링으로 토큰을 뿌리게 되면 그때 SpaCsrfTokenRequestHandler로.
     */
    private CsrfTokenRequestAttributeHandler csrfTokenRequestHandler() {
        CsrfTokenRequestAttributeHandler handler = new CsrfTokenRequestAttributeHandler();
        handler.setCsrfRequestAttributeName(null);
        return handler;
    }
}
