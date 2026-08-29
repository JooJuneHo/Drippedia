package com.drippedia.recipe;

import com.drippedia.auth.CurrentUserId;
import com.drippedia.domain.recipe.RecipeComment;
import com.drippedia.domain.recipe.RecipeCommentRepository;
import com.drippedia.domain.recipe.RecipeRepository;
import com.drippedia.domain.user.User;
import com.drippedia.domain.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 레시피 댓글 + 대댓글. 대댓글은 원댓글에만 달 수 있다(한 단계).
 * ponytail: 댓글은 상세 화면 하나에서만 쓰니 컨트롤러 하나로 끝낸다. 알림·멘션이 붙으면 그때 분리.
 */
@RestController
@RequestMapping("/api/recipes/{recipeId}/comments")
@RequiredArgsConstructor
public class RecipeCommentController {

    private final RecipeCommentRepository commentRepository;
    private final RecipeRepository recipeRepository;
    private final UserRepository userRepository;

    /** 레시피 목록/상세와 같은 이유로 표시용 기본값을 둔다. */
    private static final String UNKNOWN_AUTHOR = "알 수 없음";

    /** 원댓글에 대댓글을 물려서 내려준다. 로그인 없이도 볼 수 있다(그땐 mine이 다 false). */
    @GetMapping
    public List<View> list(@CurrentUserId Long userId, @PathVariable Long recipeId) {
        List<RecipeComment> all = commentRepository.findByRecipeIdOrderByCreatedAtAsc(recipeId);
        if (all.isEmpty()) {
            return List.of();
        }

        // 연관관계를 안 쓰니 작성자 닉네임은 id를 모아 한 번에 조회한다(쿼리 2번, N+1 아님).
        Set<Long> authorIds = all.stream().map(RecipeComment::getAuthorId).collect(Collectors.toSet());
        Map<Long, String> nicknames = userRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(User::getId, User::getNickname));

        Map<Long, List<View>> replies = all.stream()
                .filter(c -> c.getParentId() != null)
                .collect(Collectors.groupingBy(RecipeComment::getParentId,
                        Collectors.mapping(c -> view(c, userId, nicknames, List.of()), Collectors.toList())));

        return all.stream()
                .filter(c -> c.getParentId() == null)
                .map(c -> view(c, userId, nicknames, replies.getOrDefault(c.getId(), List.of())))
                .toList();
    }

    /** 댓글 등록. parentId를 주면 그 댓글의 대댓글이 된다. */
    @PostMapping
    @Transactional
    public ResponseEntity<Void> add(@CurrentUserId Long userId, @PathVariable Long recipeId,
                                    @Valid @RequestBody Form request) {
        if (!recipeRepository.existsById(recipeId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "레시피를 찾을 수 없습니다.");
        }
        if (request.parentId() != null) {
            RecipeComment parent = commentRepository.findById(request.parentId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."));
            // 화면이 한 단계까지만 그린다. 대댓글의 대댓글이나 남의 레시피 댓글에 물리는 건 막는다.
            if (parent.getParentId() != null || !parent.getRecipeId().equals(recipeId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "대댓글에는 답글을 달 수 없습니다.");
            }
        }

        commentRepository.save(new RecipeComment(recipeId, userId, request.parentId(), request.content()));

        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    /** 내가 쓴 댓글만 고친다. 내용만 바뀌고 대댓글은 그대로 붙어 있는다. */
    @PutMapping("/{commentId}")
    @Transactional
    public ResponseEntity<Void> edit(@CurrentUserId Long userId, @PathVariable Long recipeId,
                                     @PathVariable Long commentId, @Valid @RequestBody Form request) {
        mustOwn(commentId, userId).update(request.content());

        return ResponseEntity.noContent().build();
    }

    /** 내가 쓴 댓글만 지운다. 원댓글을 지우면 달린 대댓글도 같이 사라진다. */
    @DeleteMapping("/{commentId}")
    @Transactional
    public ResponseEntity<Void> delete(@CurrentUserId Long userId, @PathVariable Long recipeId,
                                       @PathVariable Long commentId) {
        RecipeComment comment = mustOwn(commentId, userId);

        commentRepository.deleteByParentId(commentId);
        commentRepository.delete(comment);

        return ResponseEntity.noContent().build();
    }

    /** 남의 댓글을 고치거나 지우지 못하게. 없으면 404, 남의 것이면 403. */
    private RecipeComment mustOwn(Long commentId, Long userId) {
        RecipeComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."));
        if (!comment.getAuthorId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "내가 쓴 댓글만 고치거나 지울 수 있습니다.");
        }
        return comment;
    }

    private View view(RecipeComment c, Long userId, Map<Long, String> nicknames, List<View> replies) {
        return new View(c.getId(), c.getContent(), nicknames.getOrDefault(c.getAuthorId(), UNKNOWN_AUTHOR),
                c.getCreatedAt(), Objects.equals(c.getAuthorId(), userId), replies);
    }

    public record Form(@NotBlank @Size(max = 500) String content, Long parentId) {
    }

    /** 대댓글은 replies에 담겨 내려간다. 대댓글의 replies는 항상 빈 목록. */
    public record View(Long id, String content, String author, LocalDateTime createdAt,
                       boolean mine, List<View> replies) {
    }
}
