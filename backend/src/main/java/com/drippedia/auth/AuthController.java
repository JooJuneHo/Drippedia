package com.drippedia.auth;

import com.drippedia.domain.user.User;
import com.drippedia.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;

    /** 로그인 상태 확인용. 프론트가 첫 진입에 이걸 찔러보고 401이면 로그인 버튼을 보여주면 된다. */
    @GetMapping("/me")
    public ResponseEntity<Me> me(@CurrentUserId Long userId) {
        return userRepository.findById(userId)
                .map(u -> ResponseEntity.ok(Me.from(u)))
                .orElseGet(() -> ResponseEntity.status(401).build());
    }

    public record Me(Long id, String nickname, String provider) {
        static Me from(User user) {
            return new Me(user.getId(), user.getNickname(), user.getProvider().name());
        }
    }
}
