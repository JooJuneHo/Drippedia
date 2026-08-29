package com.drippedia.domain.recipe;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 레시피 좋아요. RecipeSave와 판박이지만 JPA 연관관계 없이 id 값만 들고 있는다.
 * 같은 레시피에 두 번 좋아요 하는 건 unique 제약으로 막는다.
 */
@Entity
@Table(
        name = "recipe_like",
        uniqueConstraints = @UniqueConstraint(name = "uk_recipe_like", columnNames = {"userId", "recipeId"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecipeLike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Long recipeId;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public RecipeLike(Long userId, Long recipeId) {
        this.userId = userId;
        this.recipeId = recipeId;
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
