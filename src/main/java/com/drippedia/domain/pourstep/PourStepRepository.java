package com.drippedia.domain.pourstep;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PourStepRepository extends JpaRepository<PourStep, Long> {

    List<PourStep> findByRecipeIdOrderByStepOrderAsc(Long recipeId);

    void deleteByRecipeId(Long recipeId);
}
