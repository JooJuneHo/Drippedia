package com.drippedia.recipe;

import com.drippedia.domain.recipe.Recipe;
import com.drippedia.domain.recipe.RecipeComment;
import com.drippedia.domain.recipe.RecipeCommentRepository;
import com.drippedia.domain.recipe.RecipeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
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
class RecipeCommentControllerTest {

    private static final Long USER_ID = 778L;

    @Autowired private MockMvc mockMvc;
    @Autowired private RecipeRepository recipeRepository;
    @Autowired private RecipeCommentRepository commentRepository;

    private RequestPostProcessor loggedIn() {
        return oauth2Login().attributes(a -> a.put("userId", USER_ID));
    }

    private Recipe recipe() {
        return recipeRepository.save(Recipe.builder()
                .authorId(USER_ID).title("댓글 달 레시피").beanName("케냐").dripper("V60")
                .coffeeAmount(20).waterAmount(320).waterTemp(93).build());
    }

    private void write(Long recipeId, String content, Long parentId) throws Exception {
        String body = parentId == null
                ? "{\"content\":\"%s\"}".formatted(content)
                : "{\"content\":\"%s\",\"parentId\":%d}".formatted(content, parentId);

        mockMvc.perform(post("/api/recipes/" + recipeId + "/comments").with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
    }

    @Test
    void 대댓글은_원댓글에_물려서_내려온다() throws Exception {
        Recipe recipe = recipe();
        write(recipe.getId(), "잘 봤습니다", null);
        Long parentId = commentRepository.findByRecipeIdOrderByCreatedAtAsc(recipe.getId()).getFirst().getId();
        write(recipe.getId(), "저도요", parentId);

        mockMvc.perform(get("/api/recipes/" + recipe.getId() + "/comments").with(loggedIn()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1)) // 대댓글은 목록 맨 위로 안 올라온다
                .andExpect(jsonPath("$[0].content").value("잘 봤습니다"))
                .andExpect(jsonPath("$[0].mine").value(true))
                .andExpect(jsonPath("$[0].replies.length()").value(1))
                .andExpect(jsonPath("$[0].replies[0].content").value("저도요"));
    }

    @Test
    void 대댓글에는_또_답글을_못_단다() throws Exception {
        Recipe recipe = recipe();
        write(recipe.getId(), "원댓글", null);
        Long parentId = commentRepository.findByRecipeIdOrderByCreatedAtAsc(recipe.getId()).getFirst().getId();
        write(recipe.getId(), "대댓글", parentId);
        Long replyId = commentRepository.findByRecipeIdOrderByCreatedAtAsc(recipe.getId()).getLast().getId();

        mockMvc.perform(post("/api/recipes/" + recipe.getId() + "/comments").with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"여기까지\",\"parentId\":%d}".formatted(replyId)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 원댓글을_지우면_달린_대댓글도_사라진다() throws Exception {
        Recipe recipe = recipe();
        write(recipe.getId(), "원댓글", null);
        Long parentId = commentRepository.findByRecipeIdOrderByCreatedAtAsc(recipe.getId()).getFirst().getId();
        write(recipe.getId(), "대댓글", parentId);

        mockMvc.perform(delete("/api/recipes/" + recipe.getId() + "/comments/" + parentId)
                        .with(loggedIn()).with(csrf()))
                .andExpect(status().isNoContent());

        assertThat(commentRepository.findByRecipeIdOrderByCreatedAtAsc(recipe.getId())).isEmpty();
    }

    @Test
    void 내_댓글은_고칠_수_있고_남의_것은_403() throws Exception {
        Recipe recipe = recipe();
        write(recipe.getId(), "오타 있음", null);
        Long mine = commentRepository.findByRecipeIdOrderByCreatedAtAsc(recipe.getId()).getFirst().getId();
        RecipeComment others = commentRepository.save(new RecipeComment(recipe.getId(), 1234L, null, "남의 댓글"));

        mockMvc.perform(put("/api/recipes/" + recipe.getId() + "/comments/" + mine).with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"오타 고침\"}"))
                .andExpect(status().isNoContent());
        assertThat(commentRepository.findById(mine).orElseThrow().getContent()).isEqualTo("오타 고침");

        mockMvc.perform(put("/api/recipes/" + recipe.getId() + "/comments/" + others.getId()).with(loggedIn()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"남의 글 고치기\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void 남의_댓글은_못_지운다() throws Exception {
        Recipe recipe = recipe();
        RecipeComment others = commentRepository.save(new RecipeComment(recipe.getId(), 1234L, null, "남의 댓글"));

        mockMvc.perform(delete("/api/recipes/" + recipe.getId() + "/comments/" + others.getId())
                        .with(loggedIn()).with(csrf()))
                .andExpect(status().isForbidden());
    }
}
