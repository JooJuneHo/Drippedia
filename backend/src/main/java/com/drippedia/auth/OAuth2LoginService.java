package com.drippedia.auth;

import com.drippedia.domain.user.AuthProvider;
import com.drippedia.domain.user.User;
import com.drippedia.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 소셜 로그인 성공 후 우리 DB의 User와 연결한다.
 * (provider, providerId)로 찾아보고 없으면 새로 만든다 = 회원가입 절차가 따로 없음.
 * 로그인 뒤에는 principal의 "userId" 속성으로 우리 User.id를 꺼내 쓴다.
 */
@Service
@RequiredArgsConstructor
public class OAuth2LoginService extends DefaultOAuth2UserService {

    static final String USER_ID_ATTRIBUTE = "userId";

    private final UserRepository userRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest request) {
        OAuth2User oAuth2User = super.loadUser(request);
        String registrationId = request.getClientRegistration().getRegistrationId();

        User user = upsert(registrationId, oAuth2User.getAttributes());

        Map<String, Object> attributes = new HashMap<>(oAuth2User.getAttributes());
        attributes.put(USER_ID_ATTRIBUTE, user.getId());
        return new DefaultOAuth2User(
                List.of(new SimpleGrantedAuthority("ROLE_USER")),
                attributes,
                USER_ID_ATTRIBUTE
        );
    }

    @Transactional
    public User upsert(String registrationId, Map<String, Object> attributes) {
        AuthProvider provider = AuthProvider.valueOf(registrationId.toUpperCase());
        String providerId = providerId(provider, attributes);
        String nickname = nickname(provider, attributes);

        return userRepository.findByProviderAndProviderId(provider, providerId)
                .orElseGet(() -> userRepository.save(User.builder()
                        .provider(provider)
                        .providerId(providerId)
                        .nickname(uniqueNickname(nickname))
                        .build()));
    }

    private String providerId(AuthProvider provider, Map<String, Object> attributes) {
        Object id = switch (provider) {
            case GOOGLE -> attributes.get("sub");
            case KAKAO -> attributes.get("id");
        };
        if (id == null) {
            throw new IllegalStateException(provider + " 응답에 사용자 식별자가 없습니다: " + attributes.keySet());
        }
        return id.toString();
    }

    @SuppressWarnings("unchecked")
    private String nickname(AuthProvider provider, Map<String, Object> attributes) {
        Object name = switch (provider) {
            case GOOGLE -> attributes.get("name");
            // 카카오는 닉네임이 kakao_account.profile.nickname 안에 중첩돼 있고, 동의 안 하면 아예 없다
            case KAKAO -> {
                Map<String, Object> account = (Map<String, Object>) attributes.get("kakao_account");
                Map<String, Object> profile = account == null ? null : (Map<String, Object>) account.get("profile");
                yield profile == null ? null : profile.get("nickname");
            }
        };
        String nickname = name == null ? null : name.toString().trim();
        return nickname == null || nickname.isEmpty() ? "드리퍼" : nickname;
    }

    /**
     * nickname은 unique라 겹치면 뒤에 -1, -2를 붙인다.
     * ponytail: 순차 스캔이라 같은 닉네임이 수천 개면 느려진다. 그때 랜덤 suffix로.
     * 동시 가입 경합은 DB unique 제약이 막고 재시도는 하지 않는다(로그인 한 번 실패).
     */
    private String uniqueNickname(String base) {
        String trimmed = cut(base, 30);
        String candidate = trimmed;
        for (int i = 1; userRepository.existsByNickname(candidate); i++) {
            String suffix = "-" + i;
            candidate = cut(trimmed, 30 - suffix.length()) + suffix;
        }
        return candidate;
    }

    private String cut(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
