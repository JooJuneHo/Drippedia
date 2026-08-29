package com.drippedia.domain.recipe;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    /**
     * 목록 화면 세 개(전체 / 내가 쓴 것 / 내가 저장한 것)가 다 이걸 쓴다.
     * q는 컨트롤러에서 소문자 %검색어% 형태로 만들어 넘긴다(태그는 상세 설명에 그대로 들어 있어 같이 걸린다).
     * null을 넘기면 그 조건은 무시(전체 목록 = 넷 다 null).
     */
    @Query("""
            select r from Recipe r
            where (:dripper is null or r.dripper = :dripper)
              and (:authorId is null or r.authorId = :authorId)
              and (:savedBy is null or r.id in (select s.recipeId from RecipeSave s where s.userId = :savedBy))
              and (:q is null
                   or lower(r.title) like :q
                   or lower(r.beanName) like :q
                   or lower(r.description) like :q)
            order by r.createdAt desc, r.id desc
            """)
    List<Recipe> search(@Param("dripper") String dripper,
                        @Param("authorId") Long authorId,
                        @Param("savedBy") Long savedBy,
                        @Param("q") String q);
}
