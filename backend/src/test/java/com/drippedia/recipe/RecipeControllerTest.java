package com.drippedia.recipe;

import com.drippedia.domain.pourstep.PourStep;
import com.drippedia.domain.pourstep.PourStepRepository;
import com.drippedia.domain.recipe.Recipe;
import com.drippedia.domain.recipe.RecipeLike;
import com.drippedia.domain.recipe.RecipeLikeRepository;
import com.drippedia.domain.recipe.RecipeRepository;
import com.drippedia.domain.user.AuthProvider;
import com.drippedia.domain.user.User;
import com.drippedia.domain.user.UserRepository;
import org.assertj.core.groups.Tuple;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RecipeControllerTest {

    private static final Long USER_ID = 777L;
    private static final String ONE_STEP = "[{\"startTimeSeconds\":0,\"pourAmount\":50}]";

    @Autowired private MockMvc mockMvc;
    @Autowired private RecipeRepository recipeRepository;
    @Autowired private PourStepRepository pourStepRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RecipeLikeRepository recipeLikeRepository;

    /** 로그인 사용자 흉내. @CurrentUserId가 principal의 attributes["userId"]를 읽는다. */
    private RequestPostProcessor loggedIn() {
        return oauth2Login().attributes(a -> a.put("userId", USER_ID));
    }

    private String body(String steps) {
        return """
                {"title":"에티오피아 아침","beanName":"예가체프","origin":"에티오피아","purchaseUrl":"https://shop.example.com/yirga","dripper":"V60","serveType":"HOT",
                 "coffeeAmount":20,"waterAmount":320,"waterTemp":93,"steps":%s}
                """.formatted(steps);
    }

    @Test
    void 등록하면_푸어_단계에_순서가_1부터_매겨진다() throws Exception {
        String steps = """
                [{"startTimeSeconds":0,"pourAmount":50,"note":"뜸"},
                 {"startTimeSeconds":45,"pourAmount":150},
                 {"startTimeSeconds":90,"pourAmount":120}]""";

        mockMvc.perform(post("/api/recipes").with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(steps)))
                .andExpect(status().isCreated());

        Recipe saved = recipeRepository.search(null, USER_ID, null, null, "", Pageable.unpaged()).getFirst();
        assertThat(saved.getTitle()).isEqualTo("에티오피아 아침");
        assertThat(pourStepRepository.findByRecipeIdOrderByStepOrderAsc(saved.getId()))
                .extracting(PourStep::getStepOrder, PourStep::getPourAmount)
                .containsExactly(Tuple.tuple(1, 50), Tuple.tuple(2, 150), Tuple.tuple(3, 120));
    }

    @Test
    void 홈_목록에는_남이_올린_레시피가_작성자_닉네임과_함께_나온다() throws Exception {
        User author = userRepository.save(User.builder()
                .provider(AuthProvider.GOOGLE).providerId("other-user").nickname("옆자리바리스타").build());
        recipeRepository.save(Recipe.builder()
                .authorId(author.getId()).title("남의 레시피").beanName("케냐").dripper("V60")
                .coffeeAmount(20).waterAmount(320).waterTemp(93).build());

        mockMvc.perform(get("/api/recipes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("남의 레시피"))
                .andExpect(jsonPath("$[0].author").value("옆자리바리스타"));
    }

    @Test
    void 상세는_푸어_단계를_순서대로_내려준다() throws Exception {
        String steps = """
                [{"startTimeSeconds":0,"pourAmount":50,"note":"뜸"},
                 {"startTimeSeconds":45,"pourAmount":150},
                 {"startTimeSeconds":90,"pourAmount":120}]""";
        mockMvc.perform(post("/api/recipes").with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(steps)))
                .andExpect(status().isCreated());
        Long id = recipeRepository.search(null, USER_ID, null, null, "", Pageable.unpaged()).getFirst().getId();

        mockMvc.perform(get("/api/recipes/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("에티오피아 아침"))
                .andExpect(jsonPath("$.purchaseUrl").value("https://shop.example.com/yirga"))
                .andExpect(jsonPath("$.steps.length()").value(3))
                .andExpect(jsonPath("$.steps[0].stepOrder").value(1))
                .andExpect(jsonPath("$.steps[0].note").value("뜸"))
                .andExpect(jsonPath("$.steps[2].pourAmount").value(120));
    }

    @Test
    void 없는_레시피_상세는_404() throws Exception {
        mockMvc.perform(get("/api/recipes/99999999")).andExpect(status().isNotFound());
    }

    @Test
    void 푸어_단계가_없으면_400() throws Exception {
        mockMvc.perform(post("/api/recipes").with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body("[]")))
                .andExpect(status().isBadRequest());

        assertThat(recipeRepository.search(null, USER_ID, null, null, "", Pageable.unpaged())).isEmpty();
    }

    @Test
    void 물_온도가_범위를_벗어나면_400() throws Exception {
        String tooHot = body(ONE_STEP).replace("\"waterTemp\":93", "\"waterTemp\":300");

        mockMvc.perform(post("/api/recipes").with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(tooHot))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 핫도_아이스도_아니면_400() throws Exception {
        String wrong = body(ONE_STEP).replace("\"serveType\":\"HOT\"", "\"serveType\":\"미지근\"");

        mockMvc.perform(post("/api/recipes").with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(wrong))
                .andExpect(status().isBadRequest());
    }

    /** 상세 화면에서 링크로 걸리는 값이라 http/https가 아니면 아예 못 들어오게 막는다. */
    @Test
    void 구입_링크가_http가_아니면_400() throws Exception {
        String script = body(ONE_STEP)
                .replace("\"https://shop.example.com/yirga\"", "\"javascript:alert(1)\"");

        mockMvc.perform(post("/api/recipes").with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(script))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 로그인_안_하면_401() throws Exception {
        mockMvc.perform(post("/api/recipes").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(ONE_STEP)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void CSRF_토큰이_없으면_403() throws Exception {
        mockMvc.perform(post("/api/recipes").with(loggedIn())
                        .contentType(MediaType.APPLICATION_JSON).content(body(ONE_STEP)))
                .andExpect(status().isForbidden());
    }
    /** 남이 올린 레시피 하나. 저장/권한 테스트가 다 이걸 쓴다. */
    private Recipe othersRecipe() {
        return recipeRepository.save(Recipe.builder()
                .authorId(1234L).title("남의 레시피").beanName("케냐").dripper("V60")
                .coffeeAmount(20).waterAmount(320).waterTemp(93).build());
    }

    @Test
    void 저장하면_저장한_목록에_뜨고_취소하면_사라진다() throws Exception {
        Recipe other = othersRecipe();

        mockMvc.perform(post("/api/recipes/" + other.getId() + "/save").with(loggedIn()).with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/recipes/saved").with(loggedIn()))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("남의 레시피"));

        mockMvc.perform(delete("/api/recipes/" + other.getId() + "/save").with(loggedIn()).with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/recipes/saved").with(loggedIn()))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void 남의_레시피는_수정도_삭제도_못_한다() throws Exception {
        Recipe other = othersRecipe();

        mockMvc.perform(put("/api/recipes/" + other.getId()).with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(ONE_STEP)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/recipes/" + other.getId()).with(loggedIn()).with(csrf()))
                .andExpect(status().isForbidden());

        assertThat(recipeRepository.findById(other.getId())).isPresent();
    }

    @Test
    void 수정하면_푸어_단계가_통째로_갈린다() throws Exception {
        mockMvc.perform(post("/api/recipes").with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(ONE_STEP)))
                .andExpect(status().isCreated());
        Long id = recipeRepository.search(null, USER_ID, null, null, "", Pageable.unpaged()).getFirst().getId();

        String steps = """
                [{"startTimeSeconds":0,"pourAmount":40},{"startTimeSeconds":30,"pourAmount":200}]""";
        mockMvc.perform(put("/api/recipes/" + id).with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(steps)))
                .andExpect(status().isOk());

        assertThat(pourStepRepository.findByRecipeIdOrderByStepOrderAsc(id))
                .extracting(PourStep::getStepOrder, PourStep::getPourAmount)
                .containsExactly(Tuple.tuple(1, 40), Tuple.tuple(2, 200));
    }
    @Test
    void 좋아요는_켰다_껐다_되고_개수가_상세에_같이_나온다() throws Exception {
        Recipe other = othersRecipe();

        mockMvc.perform(post("/api/recipes/" + other.getId() + "/like").with(loggedIn()).with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/recipes/" + other.getId()).with(loggedIn()))
                .andExpect(jsonPath("$.liked").value(true))
                .andExpect(jsonPath("$.likes").value(1));

        mockMvc.perform(delete("/api/recipes/" + other.getId() + "/like").with(loggedIn()).with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/recipes/" + other.getId()).with(loggedIn()))
                .andExpect(jsonPath("$.liked").value(false))
                .andExpect(jsonPath("$.likes").value(0));
    }
    @Test
    void 인기_레시피는_이번_달_좋아요가_많은_순서다() throws Exception {
        Recipe popular = othersRecipe();
        Recipe second = othersRecipe();
        // 개발 DB를 그대로 쓰는 테스트라, 손으로 누른 좋아요에 밀리지 않게 넉넉히 눌러 둔다.
        for (long user = 1; user <= 5; user++) {
            recipeLikeRepository.save(new RecipeLike(user, popular.getId()));
        }
        for (long user = 1; user <= 4; user++) {
            recipeLikeRepository.save(new RecipeLike(user, second.getId()));
        }

        mockMvc.perform(get("/api/recipes/popular"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(popular.getId()))
                .andExpect(jsonPath("$[0].likes").value(5))
                .andExpect(jsonPath("$[1].id").value(second.getId()));
    }

    /** 목록 카드는 태그만 보여준다 - 줄바꿈 뒤 본문이나 링크의 #조각이 태그로 딸려 나오면 안 된다. */
    @Test
    void 태그는_줄바꿈에서_끊기고_링크는_태그가_아니다() throws Exception {
        String body = """
                {"title":"에티오피아 아침","beanName":"예가체프","origin":"에티오피아","dripper":"V60","serveType":"HOT",
                 "description":"#산미\\nhttps://ex.com/a#t=30 참고",
                 "coffeeAmount":20,"waterAmount":320,"waterTemp":93,"steps":%s}
                """.formatted(ONE_STEP);

        mockMvc.perform(post("/api/recipes").with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tags.length()").value(1))
                .andExpect(jsonPath("$.tags[0]").value("#산미"));
    }
}
