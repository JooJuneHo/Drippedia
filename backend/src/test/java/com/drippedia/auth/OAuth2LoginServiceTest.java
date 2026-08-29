package com.drippedia.auth;

import com.drippedia.domain.user.AuthProvider;
import com.drippedia.domain.user.User;
import com.drippedia.domain.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class OAuth2LoginServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final OAuth2LoginService service = new OAuth2LoginService(userRepository);

    private void noExistingUser() {
        when(userRepository.findByProviderAndProviderId(any(), anyString())).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void 구글_첫_로그인이면_User를_새로_만든다() {
        noExistingUser();
        when(userRepository.existsByNickname(anyString())).thenReturn(false);

        User user = service.upsert("google", Map.of("sub", "1234", "name", "제이슨"));

        assertThat(user.getProvider()).isEqualTo(AuthProvider.GOOGLE);
        assertThat(user.getProviderId()).isEqualTo("1234");
        assertThat(user.getNickname()).isEqualTo("제이슨");
    }

    @Test
    void 카카오는_중첩된_kakao_account에서_닉네임을_꺼낸다() {
        noExistingUser();
        when(userRepository.existsByNickname(anyString())).thenReturn(false);

        Map<String, Object> attributes = new HashMap<>();
        attributes.put("id", 987654321L);
        attributes.put("kakao_account", Map.of("profile", Map.of("nickname", "카린")));

        User user = service.upsert("kakao", attributes);

        assertThat(user.getProvider()).isEqualTo(AuthProvider.KAKAO);
        assertThat(user.getProviderId()).isEqualTo("987654321");
        assertThat(user.getNickname()).isEqualTo("카린");
    }

    @Test
    void 닉네임_동의를_안_했으면_기본_닉네임을_쓴다() {
        noExistingUser();
        when(userRepository.existsByNickname(anyString())).thenReturn(false);

        User user = service.upsert("kakao", Map.of("id", 1L));

        assertThat(user.getNickname()).isEqualTo("드리퍼");
    }

    @Test
    void 닉네임이_겹치면_뒤에_번호를_붙인다() {
        noExistingUser();
        when(userRepository.existsByNickname("제이슨")).thenReturn(true);
        when(userRepository.existsByNickname("제이슨-1")).thenReturn(true);
        when(userRepository.existsByNickname("제이슨-2")).thenReturn(false);

        User user = service.upsert("google", Map.of("sub", "1234", "name", "제이슨"));

        assertThat(user.getNickname()).isEqualTo("제이슨-2");
    }

    @Test
    void 이미_가입한_계정이면_새로_만들지_않는다() {
        User existing = User.builder()
                .provider(AuthProvider.GOOGLE).providerId("1234").nickname("제이슨").build();
        when(userRepository.findByProviderAndProviderId(AuthProvider.GOOGLE, "1234"))
                .thenReturn(Optional.of(existing));

        User user = service.upsert("google", Map.of("sub", "1234", "name", "바뀐이름"));

        assertThat(user).isSameAs(existing);
        verify(userRepository, never()).save(any());
    }
}
