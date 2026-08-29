package com.drippedia.recipe;

import com.drippedia.domain.recipe.Recipe;
import com.drippedia.domain.recipe.RecipeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

/** 목록 화면이 search() 하나에 다 걸려 있으니, null 조건 조합만 확인해 둔다. */
@SpringBootTest
@Transactional
class RecipeRepositoryTest {

    @Autowired
    private RecipeRepository recipeRepository;

    private Recipe save(Long authorId, String title, String method) {
        return recipeRepository.saveAndFlush(Recipe.builder()
                .authorId(authorId).title(title).brewMethod(method)
                .coffeeAmount(20).waterAmount(320).waterTemp(93)
                .build());
    }

    @Test
    void 조건이_없으면_전체를_최신순으로_준다() {
        Recipe old = save(1L, "먼저 등록", "V60");
        Recipe recent = save(2L, "나중 등록", "CHEMEX");

        assertThat(recipeRepository.search(null, null, null, null))
                .extracting(Recipe::getId)
                .containsSubsequence(recent.getId(), old.getId());
    }

    @Test
    void 도구로_거른다() {
        save(1L, "V60 레시피", "V60");
        save(1L, "케멕스 레시피", "CHEMEX");

        assertThat(recipeRepository.search("CHEMEX", null, null, null))
                .extracting(Recipe::getBrewMethod)
                .containsOnly("CHEMEX");
    }

    @Test
    void 작성자로_거르면_내_레시피만_나온다() {
        Recipe mine = save(42L, "내 레시피", "V60");
        save(43L, "남의 레시피", "V60");

        assertThat(recipeRepository.search(null, 42L, null, null))
                .extracting(Recipe::getId)
                .containsExactly(mine.getId());
    }

    @Test
    void 도구와_작성자를_같이_걸_수도_있다() {
        Recipe target = save(42L, "내 케멕스", "CHEMEX");
        save(42L, "내 V60", "V60");
        save(43L, "남의 케멕스", "CHEMEX");

        assertThat(recipeRepository.search("CHEMEX", 42L, null, null))
                .extracting(Recipe::getId)
                .containsExactly(target.getId());
    }
    @Test
    void 검색어는_제목도_태그도_같이_훑는다() {
        Recipe tagged = recipeRepository.saveAndFlush(Recipe.builder()
                .authorId(1L).title("아침 커피").beanName("예가체프").brewMethod("V60")
                .coffeeAmount(20).waterAmount(320).waterTemp(93)
                .description("고소하고 달다 #플로럴 #데일리").build());
        save(1L, "저녁 커피", "V60");

        assertThat(recipeRepository.search(null, null, null, "%#플로럴%"))
                .extracting(Recipe::getId)
                .containsExactly(tagged.getId());
        assertThat(recipeRepository.search(null, null, null, "%아침%"))
                .extracting(Recipe::getId)
                .containsExactly(tagged.getId());
    }
}
