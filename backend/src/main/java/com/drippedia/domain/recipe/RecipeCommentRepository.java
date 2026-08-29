package com.drippedia.domain.recipe;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecipeCommentRepository extends JpaRepository<RecipeComment, Long> {

    /** 원댓글과 대댓글을 한 번에 가져온다. 묶는 건 컨트롤러가 메모리에서 한다(쿼리 1번). */
    List<RecipeComment> findByRecipeIdOrderByCreatedAtAsc(Long recipeId);

    /** 레시피가 지워질 때 댓글도 같이. */
    void deleteByRecipeId(Long recipeId);

    /** 원댓글을 지우면 거기 달린 대댓글도 같이(고아 댓글을 안 남긴다). */
    void deleteByParentId(Long parentId);
}
