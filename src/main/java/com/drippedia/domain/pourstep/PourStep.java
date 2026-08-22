package com.drippedia.domain.pourstep;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Recipe와 JPA 연관관계를 맺지 않음. recipeId는 Recipe.id를 가리키는 순수 값.
 * Recipe 삭제 시 cascade가 없으므로, 서비스 레이어에서
 * PourStepRepository.deleteByRecipeId(recipeId)를 명시적으로 호출해야 함.
 */
@Entity
@Table(name = "pour_step")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PourStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long recipeId;

    @Column(nullable = false)
    private Integer stepOrder;

    @Column(nullable = false)
    private Integer startTimeSeconds;

    @Column(nullable = false)
    private Integer pourAmount; // 단위: g, 해당 단계에서 붓는 양(누적 아님)

    private String note;

    @Builder
    public PourStep(Long recipeId, Integer stepOrder, Integer startTimeSeconds, Integer pourAmount, String note) {
        this.recipeId = recipeId;
        this.stepOrder = stepOrder;
        this.startTimeSeconds = startTimeSeconds;
        this.pourAmount = pourAmount;
        this.note = note;
    }
}
