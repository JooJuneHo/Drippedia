# Render에는 Java 런타임이 없어서 Docker로 올린다.
# 빌드용 JDK와 실행용 JRE를 나눠서 최종 이미지에는 JAR와 런타임만 남긴다.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# 소스보다 먼저 복사해 두면 의존성 내려받은 레이어가 캐시된다(소스만 고치면 재사용).
COPY gradlew ./
COPY gradle gradle
COPY settings.gradle build.gradle ./
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon

COPY src src
# 테스트는 실제 DB에 붙어야 해서 이미지 빌드 중에는 돌리지 않는다.
RUN ./gradlew bootJar --no-daemon -x test \
 && mv "$(ls build/libs/*.jar | grep -v plain)" app.jar

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/app.jar app.jar

# 컨테이너 메모리(무료 플랜 512MB)에 맞춰 힙을 잡게 한다. 기본값은 호스트 전체를 보고 잡는다.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-jar", "app.jar"]
