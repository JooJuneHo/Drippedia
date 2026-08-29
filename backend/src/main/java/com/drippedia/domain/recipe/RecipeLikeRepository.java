package com.drippedia.domain.recipe;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

/** RecipeSaveRepository와 같은 모양. 저장과 좋아요는 성격이 달라 테이블을 나눠 뒀다. */
public interface RecipeLikeRepository extends JpaRepository<RecipeLike, Long> {

    boolean existsByUserIdAndRecipeId(Long userId, Long recipeId);

    long countByRecipeId(Long recipeId);

    /** 목록용. 레시피마다 세면 N+1이라 한 번에 세서 (recipeId, 개수) 쌍으로 받는다. */
    @Query("select r.recipeId, count(r) from RecipeLike r where r.recipeId in :recipeIds group by r.recipeId")
    List<Object[]> countByRecipeIds(@Param("recipeIds") Collection<Long> recipeIds);

    void deleteByUserIdAndRecipeId(Long userId, Long recipeId);

    void deleteByRecipeId(Long recipeId);

    void deleteByUserId(Long userId);
}
