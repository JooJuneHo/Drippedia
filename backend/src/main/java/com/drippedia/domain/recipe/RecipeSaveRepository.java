package com.drippedia.domain.recipe;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RecipeSaveRepository extends JpaRepository<RecipeSave, Long> {

    boolean existsByUserIdAndRecipeId(Long userId, Long recipeId);

    /** 저장 취소. 없던 것을 지워도 그냥 0건이라 두 번 눌러도 안전하다. */
    void deleteByUserIdAndRecipeId(Long userId, Long recipeId);

    /** 레시피가 지워질 때 남의 저장 목록에 유령이 남지 않게. */
    void deleteByRecipeId(Long recipeId);

    /** 탈퇴할 때 그 사람의 저장 목록만 지운다. */
    void deleteByUserId(Long userId);
}
