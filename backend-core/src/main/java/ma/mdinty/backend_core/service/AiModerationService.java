package ma.mdinty.backend_core.service;

import ma.mdinty.backend_core.entity.Incident;
import ma.mdinty.backend_core.repository.IncidentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

@Service
public class AiModerationService {

    private static final Logger log = LoggerFactory.getLogger(AiModerationService.class);

    private final IncidentRepository incidentRepository;
    private final JsonMapper jsonMapper;
    private final RestClient restClient;

    public AiModerationService(
            IncidentRepository incidentRepository,
            @Value("${ai.service.url:http://localhost:8001}") String aiServiceUrl
    ) {
        this.incidentRepository = incidentRepository;
        this.jsonMapper = JsonMapper.shared();

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(3));
        requestFactory.setReadTimeout(Duration.ofSeconds(20));

        this.restClient = RestClient.builder()
                .baseUrl(aiServiceUrl)
                .requestFactory(requestFactory)
                .build();
    }

    @Async
    @Transactional
    public void moderateIncidentAsync(Long incidentId) {
        Incident incident = incidentRepository.findById(incidentId).orElse(null);
        if (incident == null) {
            return;
        }

        // Sans photo, on laisse l'incident en A_VERIFIER pour modération humaine
        if (incident.getPhotoUrl() == null || incident.getPhotoUrl().isBlank()) {
            incident.setAiStatus("A_VERIFIER");
            incident.setAiReason("Aucune photo jointe — vérification manuelle requise.");
            incidentRepository.save(incident);
            return;
        }

        try {
            List<NearbyIncidentDto> nearbyDtos = Collections.emptyList();
            if (incident.getLatitude() != null && incident.getLongitude() != null) {
                List<Incident> candidates = incidentRepository.findNearbyCandidates(
                        incident.getId(),
                        incident.getLatitude(),
                        incident.getLongitude()
                );
                nearbyDtos = candidates.stream()
                        .map(this::toNearbyDto)
                        .toList();
            }

            AnalyzeRequest request = new AnalyzeRequest(
                    incident.getId(),
                    incident.getPhotoUrl(),
                    incident.getCategory() != null ? incident.getCategory() : "",
                    incident.getLatitude(),
                    incident.getLongitude(),
                    nearbyDtos
            );

            AnalyzeResponse response = restClient.post()
                    .uri("/api/v1/analyze-incident")
                    .body(request)
                    .retrieve()
                    .body(AnalyzeResponse.class);

            if (response == null) {
                throw new IllegalStateException("Réponse vide reçue de ai-service");
            }

            // 1. Fusion des doublons sous le ticket parent
            if (Boolean.TRUE.equals(response.isDuplicate()) && response.duplicateOfId() != null) {
                Incident parent = incidentRepository.findById(response.duplicateOfId()).orElse(null);
                if (parent != null) {
                    int updatedCount = Math.max(1, response.mergedReportCount());
                    parent.setDuplicateCount(updatedCount);
                    parent.setPriorityScore(computePriorityScore(parent.getAiSeverity(), updatedCount));
                    incidentRepository.save(parent);

                    incident.setAiStatus("DOUBLON");
                    incident.setParentIncidentId(parent.getId());
                    incident.setAiConfidence(response.confidence());
                    incident.setAiSeverity(response.severity());
                    incident.setAiCategoryConsistent(response.categoryConsistent());
                    incident.setAiReason(response.reason());
                    incident.setPriorityScore(parent.getPriorityScore());
                    incidentRepository.save(incident);
                    return;
                }
            }

            // 2. Mise à jour normale : Cohérence + Gravité + Score de priorité
            String severity = response.severity() != null ? response.severity() : "MOYENNE";
            int score = response.priorityScore() != null
                    ? response.priorityScore()
                    : computePriorityScore(severity, 1);

            incident.setAiStatus(response.aiStatus());
            incident.setAiConfidence(response.confidence());
            incident.setAiSeverity(severity);
            incident.setAiCategoryConsistent(response.categoryConsistent());
            incident.setAiReason(response.reason());
            incident.setPriorityScore(score);
            incident.setDuplicateCount(1);

            if (response.embedding() != null && !response.embedding().isEmpty()) {
                incident.setAiEmbeddingJson(jsonMapper.writeValueAsString(response.embedding()));
            }

            incidentRepository.save(incident);

        } catch (Exception ex) {
            // TOLÉRANCE AUX PANNES : si ai-service est éteint ou lent, aucun crash
            log.warn("ai-service indisponible pour l'incident #{} -> passage en A_VERIFIER : {}",
                    incidentId, ex.getMessage());
            incident.setAiStatus("A_VERIFIER");
            incident.setAiReason("Service IA indisponible ou délai dépassé — bascule en vérification manuelle.");
            incidentRepository.save(incident);
        }
    }

    private NearbyIncidentDto toNearbyDto(Incident cand) {
        double hoursAgo = 0.0;
        if (cand.getCreatedAt() != null) {
            hoursAgo = Math.max(0.0, Duration.between(cand.getCreatedAt(), LocalDateTime.now()).toMinutes() / 60.0);
        }
        List<Double> emb = parseEmbedding(cand.getAiEmbeddingJson());
        int count = cand.getDuplicateCount() != null ? cand.getDuplicateCount() : 1;
        return new NearbyIncidentDto(
                cand.getId(),
                cand.getLatitude(),
                cand.getLongitude(),
                emb,
                hoursAgo,
                count
        );
    }

    private List<Double> parseEmbedding(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return jsonMapper.readValue(json, new TypeReference<List<Double>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private int computePriorityScore(String severity, int duplicateCount) {
        int base = switch (severity != null ? severity.toUpperCase() : "MOYENNE") {
            case "URGENTE" -> 10;
            case "FAIBLE" -> 2;
            default -> 5;
        };
        return base + Math.max(0, duplicateCount - 1) * 3;
    }

    public record NearbyIncidentDto(
            Long incident_id,
            Double latitude,
            Double longitude,
            List<Double> embedding,
            Double hours_ago,
            Integer duplicate_count
    ) {}

    public record AnalyzeRequest(
            Long incident_id,
            String photo_url,
            String category,
            Double latitude,
            Double longitude,
            List<NearbyIncidentDto> nearby_incidents
    ) {}

    public record AnalyzeResponse(
            Long incident_id,
            String ai_status,
            Double confidence,
            Boolean is_valid,
            Boolean category_consistent,
            String predicted_category,
            String severity,
            Integer priority_score,
            Boolean is_duplicate,
            Long duplicate_of_id,
            Integer merged_report_count,
            String reason,
            List<Double> embedding
    ) {
        public String aiStatus() { return ai_status; }
        public Double confidence() { return confidence; }
        public Boolean categoryConsistent() { return category_consistent; }
        public String severity() { return severity; }
        public Integer priorityScore() { return priority_score; }
        public Boolean isDuplicate() { return is_duplicate; }
        public Long duplicateOfId() { return duplicate_of_id; }
        public Integer mergedReportCount() { return merged_report_count != null ? merged_report_count : 1; }
        public String reason() { return reason; }
        public List<Double> embedding() { return embedding; }
    }
}