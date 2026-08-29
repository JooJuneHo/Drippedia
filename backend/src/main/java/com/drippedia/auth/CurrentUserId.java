package com.drippedia.auth;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 컨트롤러 파라미터에 붙이면 로그인한 User.id가 들어온다. 로그인 안 했으면 null.
 * 익명 요청의 principal은 문자열("anonymousUser")이라 attributes를 바로 읽으면 SpEL이 터진다.
 * permitAll 경로(레시피 상세 등)에서도 그대로 쓰려고 타입 확인을 한 겹 둔다.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@AuthenticationPrincipal(expression =
        "#this instanceof T(org.springframework.security.oauth2.core.user.OAuth2User) ? attributes['userId'] : null")
public @interface CurrentUserId {
}
