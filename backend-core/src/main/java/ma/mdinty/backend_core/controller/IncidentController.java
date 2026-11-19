package ma.mdinty.backend_core.controller;

import ma.mdinty.backend_core.entity.Incident;
import ma.mdinty.backend_core.repository.IncidentRepository;
import ma.mdinty.backend_core.service.MinioService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/incidents")
@CrossOrigin(origins = "http://localhost:4200")
public class IncidentController {

    private final IncidentRepository incidentRepository;
    private final MinioService minioService;

    public IncidentController(IncidentRepository incidentRepository, MinioService minioService) {
        this.incidentRepository = incidentRepository;
        this.minioService = minioService;
    }

    @GetMapping
    public List<Incident> getAllIncidents() {
        return incidentRepository.findAll();
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
                        // L'utilisateur a déjà voté : on annule son vote (toggle)
                        incident.getVoterIds().remove(userId);
                    } else {
                        // Nouveau vote unique pour cet utilisateur
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
}