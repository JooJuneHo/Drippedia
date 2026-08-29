package com.drippedia.recipe;

import com.drippedia.auth.CurrentUserId;
import com.drippedia.domain.pourstep.PourStep;
import com.drippedia.domain.pourstep.PourStepRepository;
import com.drippedia.domain.recipe.Recipe;
import com.drippedia.domain.recipe.RecipeRepository;
import com.drippedia.domain.recipe.RecipeLike;
import com.drippedia.domain.recipe.RecipeLikeRepository;
import com.drippedia.domain.recipe.RecipeSave;
import com.drippedia.domain.recipe.RecipeSaveRepository;
import com.drippedia.domain.user.User;
import com.drippedia.domain.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.regex.MatchResult;
import java.util.regex.Pattern;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@RestController
@RequestMapping("/api/recipes")
@RequiredArgsConstructor
public class RecipeController {

    private final RecipeRepository recipeRepository;
    private final PourStepRepository pourStepRepository;
    private final RecipeSaveRepository recipeSaveRepository;
    private final RecipeLikeRepository recipeLikeRepository;
    private final UserRepository userRepository;

    /** 사용자를 못 찾았을 때 목록/상세가 통째로 깨지는 것보단 이렇게 표시하는 게 낫다. */
    private static final String UNKNOWN_AUTHOR = "알 수 없음";

    /** 상세 설명에 섞여 있는 #태그. 목록 카드에도 이걸 뽑아서 보여준다. */
    private static final Pattern TAG = Pattern.compile("#[^\s#]+");

    /** 메인 화면 목록(최신순). brewMethod를 주면 그 도구만 거른다. 로그인 없이도 볼 수 있다. */
    @GetMapping
    public List<Summary> list(@RequestParam(required = false) String brewMethod,
                              @RequestParam(required = false) String q) {
        return summaries(recipeRepository.search(brewMethod, null, null, like(q)));
    }

    /** 내가 등록한 것만. 이 경로만 SecurityConfig에서 authenticated로 잡아 뒀다(아니면 userId가 null). */
    @GetMapping("/mine")
    public List<Summary> mine(@CurrentUserId Long userId,
                              @RequestParam(required = false) String brewMethod,
                              @RequestParam(required = false) String q) {
        return summaries(recipeRepository.search(brewMethod, userId, null, like(q)));
    }

    /** 내가 저장(북마크)한 것만. /mine과 같은 이유로 authenticated. */
    @GetMapping("/saved")
    public List<Summary> saved(@CurrentUserId Long userId,
                               @RequestParam(required = false) String brewMethod,
                               @RequestParam(required = false) String q) {
        return summaries(recipeRepository.search(brewMethod, null, userId, like(q)));
    }

    /** 상세. 목록과 달리 푸어 단계까지 순서대로 딸려 나간다(브루잉 타이머가 이걸 그대로 쓴다). */
    @GetMapping("/{id}")
    public Detail detail(@CurrentUserId Long userId, @PathVariable Long id) {
        Recipe recipe = recipeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "레시피를 찾을 수 없습니다."));

        // 로그인 없이도 보는 화면이라 userId가 null일 수 있다. 그땐 저장/수정 버튼이 안 뜬다.
        return Detail.from(recipe, author(recipe.getAuthorId()),
                pourStepRepository.findByRecipeIdOrderByStepOrderAsc(id).stream().map(StepView::from).toList(),
                userId != null && recipeSaveRepository.existsByUserIdAndRecipeId(userId, id),
                recipeSaveRepository.countByRecipeId(id),
                userId != null && recipeLikeRepository.existsByUserIdAndRecipeId(userId, id),
                recipeLikeRepository.countByRecipeId(id),
                recipe.getAuthorId().equals(userId));
    }

    /**
     * 레시피 + 푸어 단계 저장. 연관관계를 안 쓰기로 했으니 두 번 저장하고,
     * 중간에 터지면 레시피만 남는 걸 막으려고 트랜잭션으로 묶는다.
     * ponytail: 서비스 클래스 없이 컨트롤러에 @Transactional. 쓰기 로직이 더 붙으면 그때 분리.
     */
    @PostMapping
    @Transactional
    public ResponseEntity<Summary> create(@CurrentUserId Long userId, @Valid @RequestBody Form request) {
        Recipe recipe = recipeRepository.save(Recipe.builder()
                .authorId(userId)
                .title(request.title())
                .beanName(request.beanName())
                .roaster(request.roaster())
                .origin(request.origin())
                .roastLevel(request.roastLevel())
                .brewMethod(request.brewMethod())
                .coffeeAmount(request.coffeeAmount())
                .waterAmount(request.waterAmount())
                .waterTemp(request.waterTemp())
                .grindSize(request.grindSize())
                .grinder(request.grinder())
                .description(request.description())
                .build());

        pourStepRepository.saveAll(steps(request, recipe.getId()));

        return ResponseEntity.status(HttpStatus.CREATED).body(summaries(List.of(recipe)).getFirst());
    }

    /** 수정. 푸어 단계는 개수가 바뀌니 지우고 다시 넣는다(순서도 그때 다시 매겨진다). */
    @PutMapping("/{id}")
    @Transactional
    public Summary update(@CurrentUserId Long userId, @PathVariable Long id, @Valid @RequestBody Form request) {
        Recipe recipe = mustOwn(id, userId);
        recipe.update(request.title(), request.beanName(), request.roaster(), request.origin(),
                request.roastLevel(), request.brewMethod(), request.coffeeAmount(), request.waterAmount(),
                request.waterTemp(), request.grindSize(), request.grinder(), request.description());

        pourStepRepository.deleteByRecipeId(id);
        pourStepRepository.saveAll(steps(request, id));

        return summaries(List.of(recipe)).getFirst();
    }

    /** 삭제. 연관관계가 없으니 딸린 것들을 직접 지운다. */
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@CurrentUserId Long userId, @PathVariable Long id) {
        mustOwn(id, userId);
        pourStepRepository.deleteByRecipeId(id);
        recipeSaveRepository.deleteByRecipeId(id);
        recipeLikeRepository.deleteByRecipeId(id);
        recipeRepository.deleteById(id);

        return ResponseEntity.noContent().build();
    }

    /** 저장(북마크). 이미 저장돼 있으면 아무 일도 안 한다 - 두 번 눌러도 안전하게. */
    @PostMapping("/{id}/save")
    @Transactional
    public ResponseEntity<Void> save(@CurrentUserId Long userId, @PathVariable Long id) {
        if (!recipeRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "레시피를 찾을 수 없습니다.");
        }
        if (!recipeSaveRepository.existsByUserIdAndRecipeId(userId, id)) {
            recipeSaveRepository.save(new RecipeSave(userId, id));
        }

        return ResponseEntity.noContent().build();
    }

    /** 저장 취소. 없던 것을 지워도 그냥 0건이다. */
    @DeleteMapping("/{id}/save")
    @Transactional
    public ResponseEntity<Void> unsave(@CurrentUserId Long userId, @PathVariable Long id) {
        recipeSaveRepository.deleteByUserIdAndRecipeId(userId, id);

        return ResponseEntity.noContent().build();
    }

    /** 좋아요. 저장과 같은 모양이고 개수는 상세에서 같이 내려간다. */
    @PostMapping("/{id}/like")
    @Transactional
    public ResponseEntity<Void> like(@CurrentUserId Long userId, @PathVariable Long id) {
        if (!recipeRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "레시피를 찾을 수 없습니다.");
        }
        if (!recipeLikeRepository.existsByUserIdAndRecipeId(userId, id)) {
            recipeLikeRepository.save(new RecipeLike(userId, id));
        }

        return ResponseEntity.noContent().build();
    }

    /** 좋아요 취소. */
    @DeleteMapping("/{id}/like")
    @Transactional
    public ResponseEntity<Void> unlike(@CurrentUserId Long userId, @PathVariable Long id) {
        recipeLikeRepository.deleteByUserIdAndRecipeId(userId, id);

        return ResponseEntity.noContent().build();
    }

    /** 남의 레시피를 고치거나 지우지 못하게. 없으면 404, 남의 것이면 403. */
    private Recipe mustOwn(Long id, Long userId) {
        Recipe recipe = recipeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "레시피를 찾을 수 없습니다."));
        if (!recipe.getAuthorId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "내가 등록한 레시피만 수정/삭제할 수 있습니다.");
        }
        return recipe;
    }

    /** stepOrder는 클라이언트가 보내는 값이 아니라 배열 순서 그대로 1부터 매긴다. */
    private List<PourStep> steps(Form request, Long recipeId) {
        return IntStream.range(0, request.steps().size())
                .mapToObj(i -> request.steps().get(i).toEntity(recipeId, i + 1))
                .toList();
    }

    /**
     * 연관관계를 안 쓰기로 했으니 작성자 닉네임은 id를 모아 한 번에 조회해서 채운다(쿼리 2번, N+1 아님).
     * 조회에 실패한 id는 표시용 기본값으로 둔다 — 목록이 통째로 깨지는 것보단 낫다.
     */
    private List<Summary> summaries(List<Recipe> recipes) {
        if (recipes.isEmpty()) {
            return List.of(); // 빈 목록에 in () 쿼리를 세 번 날릴 이유가 없다
        }

        Set<Long> authorIds = recipes.stream().map(Recipe::getAuthorId).collect(Collectors.toSet());
        Map<Long, String> nicknames = userRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(User::getId, User::getNickname));

        // 좋아요/저장 수도 카드마다 세면 N+1이라 목록 전체를 한 방에 센다(쿼리 2번 추가).
        List<Long> ids = recipes.stream().map(Recipe::getId).toList();
        Map<Long, Long> likes = counts(recipeLikeRepository.countByRecipeIds(ids));
        Map<Long, Long> saves = counts(recipeSaveRepository.countByRecipeIds(ids));

        return recipes.stream()
                .map(r -> Summary.from(r, nicknames.getOrDefault(r.getAuthorId(), UNKNOWN_AUTHOR),
                        likes.getOrDefault(r.getId(), 0L), saves.getOrDefault(r.getId(), 0L)))
                .toList();
    }

    /** (recipeId, 개수) 쌍을 찾아 쓰기 좋게 Map으로. 0건인 레시피는 아예 안 들어 있다. */
    private static Map<Long, Long> counts(List<Object[]> rows) {
        return rows.stream().collect(Collectors.toMap(row -> (Long) row[0], row -> (Long) row[1]));
    }

    /** 빈 검색어는 조건 자체를 끄고, 아니면 대소문자 구분 없는 부분 일치로 만든다. */
    private String like(String q) {
        return q == null || q.isBlank() ? null : "%" + q.trim().toLowerCase() + "%";
    }

    private String author(Long authorId) {
        return userRepository.findById(authorId).map(User::getNickname).orElse(UNKNOWN_AUTHOR);
    }

    /** 등록과 수정이 같은 폼을 쓴다. 필수값은 요구사항 그대로: 원두명, 도구, 비율(커피/물), 온도, 푸어 단계 1개 이상. */
    public record Form(
            @NotBlank @Size(max = 100) String title,
            @NotBlank @Size(max = 100) String beanName,
            @Size(max = 100) String roaster,
            @Size(max = 100) String origin,
            @Size(max = 50) String roastLevel,
            @NotBlank @Size(max = 50) String brewMethod,
            @NotNull @Positive @Max(500) Integer coffeeAmount,
            @NotNull @Positive @Max(5000) Integer waterAmount,
            @NotNull @Min(1) @Max(100) Integer waterTemp,
            @Size(max = 50) String grindSize,
            @Size(max = 50) String grinder,
            @Size(max = 2000) String description,
            @NotEmpty @Valid List<Step> steps) {
    }

    public record Step(
            @NotNull @PositiveOrZero @Max(3600) Integer startTimeSeconds,
            @NotNull @Positive @Max(5000) Integer pourAmount,
            @Size(max = 100) String note) {

        PourStep toEntity(Long recipeId, int stepOrder) {
            return PourStep.builder()
                    .recipeId(recipeId).stepOrder(stepOrder)
                    .startTimeSeconds(startTimeSeconds).pourAmount(pourAmount).note(note)
                    .build();
        }
    }

    /** 상세 화면용. 목록 카드에 없는 원산지/로스팅 정도/분쇄도와 푸어 단계까지 다 내려준다. */
    public record Detail(Long id, String title, String beanName, String roaster, String origin,
                         String roastLevel, String brewMethod, int coffeeAmount, int waterAmount,
                         int waterTemp, double ratio, String grindSize, String grinder, String description, String author,
                         LocalDateTime createdAt, List<StepView> steps,
                         boolean saved, long saves, boolean liked, long likes, boolean mine) {
        static Detail from(Recipe r, String author, List<StepView> steps,
                           boolean saved, long saves, boolean liked, long likes, boolean mine) {
            return new Detail(r.getId(), r.getTitle(), r.getBeanName(), r.getRoaster(), r.getOrigin(),
                    r.getRoastLevel(), r.getBrewMethod(), r.getCoffeeAmount(), r.getWaterAmount(),
                    r.getWaterTemp(), r.ratio(), r.getGrindSize(), r.getGrinder(), r.getDescription(), author,
                    r.getCreatedAt(), steps, saved, saves, liked, likes, mine);
        }
    }

    public record StepView(int stepOrder, int startTimeSeconds, int pourAmount, String note) {
        static StepView from(PourStep s) {
            return new StepView(s.getStepOrder(), s.getStartTimeSeconds(), s.getPourAmount(), s.getNote());
        }
    }

    /** 상세 설명에서 #태그만 추린다. 카드가 태그로 도배되지 않게 앞의 다섯 개까지만. */
    private static List<String> tagsOf(String description) {
        return description == null ? List.of()
                : TAG.matcher(description).results().map(MatchResult::group).limit(5).toList();
    }

    /** 목록 카드에 필요한 만큼만. 상세(PourStep 포함)는 상세 API에서. */
    public record Summary(Long id, String title, String beanName, String roaster, String brewMethod,
                          int coffeeAmount, int waterAmount, int waterTemp, double ratio,
                          String author, LocalDateTime createdAt, List<String> tags, long likes, long saves) {
        static Summary from(Recipe r, String author, long likes, long saves) {
            return new Summary(r.getId(), r.getTitle(), r.getBeanName(), r.getRoaster(),
                    r.getBrewMethod(), r.getCoffeeAmount(), r.getWaterAmount(),
                    r.getWaterTemp(), r.ratio(), author, r.getCreatedAt(), tagsOf(r.getDescription()),
                    likes, saves);
        }
    }
}
