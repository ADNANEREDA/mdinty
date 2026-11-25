package ma.mdinty.backend_core.controller;

import ma.mdinty.backend_core.entity.Incident;
import ma.mdinty.backend_core.repository.IncidentRepository;
import ma.mdinty.backend_core.service.AiModerationService;
import ma.mdinty.backend_core.service.MinioService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/incidents")
@CrossOrigin(origins = "http://localhost:4200")
public class IncidentController {

    private final IncidentRepository incidentRepository;
    private final MinioService minioService;
    private final AiModerationService aiModerationService;

    public IncidentController(
            IncidentRepository incidentRepository,
            MinioService minioService,
            AiModerationService aiModerationService
    ) {
        this.incidentRepository = incidentRepository;
        this.minioService = minioService;
        this.aiModerationService = aiModerationService;
    }

    @GetMapping
    public List<Incident> getAllIncidents() {
        return incidentRepository.findAllByOrderByCreatedAtDesc();
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Incident> createIncident(
            @RequestParam("title") String title,
            @RequestParam("description") String description,
            @RequestParam("category") String category,
            @RequestParam("address") String address,
            @RequestParam("latitude") Double latitude,
            @RequestParam("longitude") Double longitude,
            @RequestParam(value = "userId", required = false) Long userId,
            @RequestParam(value = "photo", required = false) MultipartFile photo
    ) {
        Incident incident = new Incident();
        incident.setTitle(title);
        incident.setDescription(description);
        incident.setCategory(category);
        incident.setAddress(address);
        incident.setLatitude(latitude);
        incident.setLongitude(longitude);
        incident.setStatus("EN_ATTENTE");
        incident.setUpvotes(0);
        incident.setUserId(userId);

        if (photo != null && !photo.isEmpty()) {
            String photoUrl = minioService.uploadPhoto(photo);
            incident.setPhotoUrl(photoUrl);
        }

        Incident saved = incidentRepository.save(incident);
        aiModerationService.moderateIncidentAsync(saved.getId());
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}/upvote")
    public ResponseEntity<Incident> upvoteIncident(
            @PathVariable Long id,
            @RequestParam(value = "userId", required = false) Long userId
    ) {
        return incidentRepository.findById(id)
                .map(incident -> {
                    if (userId != null) {
                        if (incident.getVoterIds().contains(userId)) {
                            incident.getVoterIds().remove(userId);
                        } else {
                            incident.getVoterIds().add(userId);
                        }
                        incident.setUpvotes(incident.getVoterIds().size());
                    } else {
                        int currentVotes = incident.getUpvotes() != null ? incident.getUpvotes() : 0;
                        incident.setUpvotes(currentVotes + 1);
                    }
                    return ResponseEntity.ok(incidentRepository.save(incident));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Incident> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        String newStatus = body.get("status");
        if (newStatus == null || newStatus.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return incidentRepository.findById(id)
                .map(incident -> {
                    String normalized = newStatus.trim().toUpperCase();
                    incident.setStatus(normalized);

                    if ("EN_COURS".equals(normalized) && incident.getAssignedAt() == null) {
                        incident.setAssignedAt(LocalDateTime.now());
                    }

                    if ("RESOLU".equals(normalized)) {
                        incident.setResolvedAt(LocalDateTime.now());
                        if (body.get("resolutionNote") != null && !body.get("resolutionNote").isBlank()) {
                            incident.setResolutionNote(body.get("resolutionNote").trim());
                        }
                        if (body.get("resolutionPhotoUrl") != null && !body.get("resolutionPhotoUrl").isBlank()) {
                            incident.setResolutionPhotoUrl(body.get("resolutionPhotoUrl").trim());
                        }
                    }

                    return ResponseEntity.ok(incidentRepository.save(incident));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/assign")
    public ResponseEntity<Incident> assignTeam(
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        String team = body.get("assignedTeam");
        String teamLabel = body.get("assignedTeamLabel");
        return incidentRepository.findById(id)
                .map(incident -> {
                    incident.setAssignedTeam(team);
                    incident.setAssignedTeamLabel(teamLabel);
                    if (incident.getAssignedAt() == null) {
                        incident.setAssignedAt(LocalDateTime.now());
                    }
                    if ("EN_ATTENTE".equalsIgnoreCase(incident.getStatus())) {
                        incident.setStatus("EN_COURS");
                    }
                    return ResponseEntity.ok(incidentRepository.save(incident));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // Endpoint prêt pour l'équipe terrain (MEMBRE_EQUIPE) : envoi photo après travaux + cahier des charges au Chef
    @PostMapping(value = "/{id}/field-report", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Incident> submitFieldReport(
            @PathVariable Long id,
            @RequestParam("resolutionNote") String resolutionNote,
            @RequestParam(value = "photo", required = false) MultipartFile photo
    ) {
        return incidentRepository.findById(id)
                .map(incident -> {
                    incident.setResolutionNote(resolutionNote);
                    if (photo != null && !photo.isEmpty()) {
                        String afterPhotoUrl = minioService.uploadPhoto(photo);
                        incident.setResolutionPhotoUrl(afterPhotoUrl);
                    }
                    return ResponseEntity.ok(incidentRepository.save(incident));
                })
                .orElse(ResponseEntity.notFound().build());
    }
    @PutMapping("/{id}/ai-status")
    public ResponseEntity<Incident> updateAiStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        String newAiStatus = body.get("aiStatus");
        if (newAiStatus == null || newAiStatus.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return incidentRepository.findById(id)
                .map(incident -> {
                    incident.setAiStatus(newAiStatus.trim().toUpperCase());
                    if (body.get("aiReason") != null && !body.get("aiReason").isBlank()) {
                        incident.setAiReason(body.get("aiReason").trim());
                    }
                    return ResponseEntity.ok(incidentRepository.save(incident));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteIncident(@PathVariable Long id) {
        if (!incidentRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        incidentRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}