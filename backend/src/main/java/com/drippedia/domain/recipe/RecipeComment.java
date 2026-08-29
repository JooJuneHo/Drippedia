package com.drippedia.domain.recipe;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 레시피 댓글. 다른 테이블과 마찬가지로 JPA 연관관계 없이 id 값만 들고 있는다.
 * 대댓글은 parentId에 원댓글 id를 담는다 - 깊이는 한 단계까지만(컨트롤러가 막는다).
 */
@Entity
@Table(name = "recipe_comment")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecipeComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long recipeId;

    @Column(nullable = false)
    private Long authorId;

    /** null이면 원댓글, 값이 있으면 그 댓글에 달린 대댓글. */
    private Long parentId;

    @Column(nullable = false, length = 500)
    private String content;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public RecipeComment(Long recipeId, Long authorId, Long parentId, String content) {
        this.recipeId = recipeId;
        this.authorId = authorId;
        this.parentId = parentId;
        this.content = content;
    }

    /** 수정은 내용만 바꾼다. 작성자·작성 시각은 그대로 둔다. */
    public void update(String content) {
        this.content = content;
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
