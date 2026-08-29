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

    /** 원두 구입 링크. http/https만 들어온다 - 컨트롤러가 걸러 준다. */
    @Column(length = 500)
    private String purchaseUrl;

    private String origin;

    @Column(nullable = false, length = 50)
    private String dripper;

    /** 핫 / 아이스. 예전 레시피는 값이 없을 수 있어 컬럼은 널을 허용한다(폼에서는 필수). */
    @Column(length = 10)
    private String serveType;

    @Column(nullable = false)
    private Integer coffeeAmount; // 단위: g

    @Column(nullable = false)
    private Integer waterAmount; // 단위: g

    @Column(nullable = false)
    private Integer waterTemp; // 단위: 섭씨

    private String grindSize;

    private String grinder;

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
    public Recipe(Long authorId, String title, String beanName, String purchaseUrl, String origin,
                  String dripper, String serveType, Integer coffeeAmount, Integer waterAmount,
                  Integer waterTemp, String grindSize, String grinder, Integer totalBrewTimeSeconds,
                  String description, String tastingNote) {
        this.authorId = authorId;
        this.title = title;
        this.beanName = beanName;
        this.purchaseUrl = purchaseUrl;
        this.origin = origin;
        this.dripper = dripper;
        this.serveType = serveType;
        this.coffeeAmount = coffeeAmount;
        this.waterAmount = waterAmount;
        this.waterTemp = waterTemp;
        this.grindSize = grindSize;
        this.grinder = grinder;
        this.totalBrewTimeSeconds = totalBrewTimeSeconds;
        this.description = description;
        this.tastingNote = tastingNote;
    }

    /** 수정 화면에서 받은 값으로 통째로 덮어쓴다. authorId/createdAt은 손대지 않는다. */
    public void update(String title, String beanName, String purchaseUrl, String origin,
                       String dripper, String serveType, Integer coffeeAmount, Integer waterAmount, Integer waterTemp,
                       String grindSize, String grinder, String description) {
        this.title = title;
        this.beanName = beanName;
        this.purchaseUrl = purchaseUrl;
        this.origin = origin;
        this.dripper = dripper;
        this.serveType = serveType;
        this.coffeeAmount = coffeeAmount;
        this.waterAmount = waterAmount;
        this.waterTemp = waterTemp;
        this.grindSize = grindSize;
        this.grinder = grinder;
        this.description = description;
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
