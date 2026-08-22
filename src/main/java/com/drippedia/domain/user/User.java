package com.drippedia.domain.user;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 소셜 로그인(구글/카카오)만 지원. 비밀번호 필드는 없다.
 * 계정 식별은 (provider, providerId) 조합이고, nickname은 표시용이라 언제든 바뀔 수 있음.
 * 다른 테이블과는 JPA 연관관계(@OneToMany 등)를 맺지 않고, 참조가 필요하면
 * 상대 테이블에서 순수 id 값(authorId 등)만 들고 있도록 설계함.
 */
@Entity
@Table(
        name = "users", // "user"는 PostgreSQL 예약어라 테이블명을 users로 사용
        uniqueConstraints = @UniqueConstraint(name = "uk_users_provider", columnNames = {"provider", "providerId"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AuthProvider provider;

    /** 소셜 서비스가 준 고유 id. 구글은 sub, 카카오는 id. */
    @Column(nullable = false, length = 100)
    private String providerId;

    @Column(nullable = false, unique = true, length = 30)
    private String nickname;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public User(AuthProvider provider, String providerId, String nickname) {
        this.provider = provider;
        this.providerId = providerId;
        this.nickname = nickname;
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
