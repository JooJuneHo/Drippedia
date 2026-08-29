package com.drippedia.auth;

import com.drippedia.domain.user.User;
import com.drippedia.domain.recipe.RecipeSaveRepository;
import com.drippedia.domain.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final RecipeSaveRepository recipeSaveRepository;

    /** 로그인 상태 확인용. 프론트가 첫 진입에 이걸 찔러보고 401이면 로그인 버튼을 보여주면 된다. */
    @GetMapping("/me")
    public ResponseEntity<Me> me(@CurrentUserId Long userId) {
        return userRepository.findById(userId)
                .map(u -> ResponseEntity.ok(Me.from(u)))
                .orElseGet(() -> ResponseEntity.status(401).build());
    }

    /** 회원 정보 수정. 닉네임만 고칠 수 있다 - provider/providerId는 소셜 계정에 묶인 값이다. */
    @PatchMapping("/me")
    @Transactional
    public ResponseEntity<Me> update(@CurrentUserId Long userId, @Valid @RequestBody Update request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        String nickname = request.nickname().trim();
        // ponytail: 확인과 저장 사이 경합은 열어 둔다(부딪히면 unique 제약이 막는다). 실제로 겪으면 그때 예외 변환으로.
        if (!nickname.equals(user.getNickname()) && userRepository.existsByNickname(nickname)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 쓰이는 닉네임입니다.");
        }
        user.changeNickname(nickname); // 더티 체킹으로 커밋 시점에 반영된다

        return ResponseEntity.ok(Me.from(user));
    }

    /**
     * 회원 탈퇴. 등록한 레시피는 남긴다 - 작성자 닉네임만 '알 수 없음'으로 표시된다.
     * 세션은 그대로 두지만 사용자가 사라지므로 다음 /api/me가 401이고, 프론트는 로그인 화면으로 넘어간다.
     */
    @DeleteMapping("/me")
    @Transactional
    public ResponseEntity<Void> withdraw(@CurrentUserId Long userId) {
        recipeSaveRepository.deleteByUserId(userId);
        userRepository.deleteById(userId);

        return ResponseEntity.noContent().build();
    }

    public record Update(@NotBlank @Size(max = 30) String nickname) {
    }

    public record Me(Long id, String nickname, String provider) {
        static Me from(User user) {
            return new Me(user.getId(), user.getNickname(), user.getProvider().name());
        }
    }
}
