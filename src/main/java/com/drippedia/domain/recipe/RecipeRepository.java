package com.drippedia.domain.recipe;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    List<Recipe> findByAuthorId(Long authorId);

    List<Recipe> findByBrewMethod(BrewMethod brewMethod);

    List<Recipe> findByTitleContaining(String keyword);
}
