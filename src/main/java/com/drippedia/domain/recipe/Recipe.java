package com.drippedia.domain.recipe;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * User, PourStep과 JPA 연관관계(@ManyToOne, @OneToMany)를 맺지 않는다.
 * authorId는 User.id를 가리키는 순수 값일 뿐, 외래키 제약이나 객체 그래프 탐색은 없음.
 * PourStep 목록이 필요하면 PourStepRepository.findByRecipeIdOrderByStepOrderAsc(id)로 별도 조회.
 */
@Entity
@Table(name = "recipe")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Recipe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long authorId;

    @Column(nullable = false, length = 100)
    private String title;

    private String beanName;
    private String roaster;
    private String origin;
    private String roastLevel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BrewMethod brewMethod;

    @Column(nullable = false)
    private Integer coffeeAmount; // 단위: g

    @Column(nullable = false)
    private Integer waterAmount; // 단위: g

    @Column(nullable = false)
    private Integer waterTemp; // 단위: 섭씨

    private String grindSize;

    private Integer totalBrewTimeSeconds;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String tastingNote;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    public Recipe(Long authorId, String title, String beanName, String roaster, String origin,
                  String roastLevel, BrewMethod brewMethod, Integer coffeeAmount, Integer waterAmount,
                  Integer waterTemp, String grindSize, Integer totalBrewTimeSeconds,
                  String description, String tastingNote) {
        this.authorId = authorId;
        this.title = title;
        this.beanName = beanName;
        this.roaster = roaster;
        this.origin = origin;
        this.roastLevel = roastLevel;
        this.brewMethod = brewMethod;
        this.coffeeAmount = coffeeAmount;
        this.waterAmount = waterAmount;
        this.waterTemp = waterTemp;
        this.grindSize = grindSize;
        this.totalBrewTimeSeconds = totalBrewTimeSeconds;
        this.description = description;
        this.tastingNote = tastingNote;
    }

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public double ratio() {
        if (coffeeAmount == null || coffeeAmount == 0) {
            return 0;
        }
        return (double) waterAmount / coffeeAmount;
    }
}
