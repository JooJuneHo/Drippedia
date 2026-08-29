package com.drippedia.domain.recipe;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface RecipeSaveRepository extends JpaRepository<RecipeSave, Long> {

    boolean existsByUserIdAndRecipeId(Long userId, Long recipeId);

    /** 저장 취소. 없던 것을 지워도 그냥 0건이라 두 번 눌러도 안전하다. */
    void deleteByUserIdAndRecipeId(Long userId, Long recipeId);

    /** 레시피가 지워질 때 남의 저장 목록에 유령이 남지 않게. */
    void deleteByRecipeId(Long recipeId);

    long countByRecipeId(Long recipeId);

    /** 목록용. 레시피마다 세면 N+1이라 한 번에 세서 (recipeId, 개수) 쌍으로 받는다. */
    @Query("select r.recipeId, count(r) from RecipeSave r where r.recipeId in :recipeIds group by r.recipeId")
    List<Object[]> countByRecipeIds(@Param("recipeIds") Collection<Long> recipeIds);

    /** 탈퇴할 때 그 사람의 저장 목록만 지운다. */
    void deleteByUserId(Long userId);
}
