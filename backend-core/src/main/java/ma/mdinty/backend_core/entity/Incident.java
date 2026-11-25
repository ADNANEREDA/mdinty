package ma.mdinty.backend_core.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "incidents")
public class Incident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 1000)
    private String description;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private String status = "EN_ATTENTE";

    @Column(nullable = false)
    private String address;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Column(name = "photo_url")
    private String photoUrl;

    @Column(nullable = false)
    private Integer upvotes = 0;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "assigned_team")
    private String assignedTeam;

    @Column(name = "assigned_team_label")
    private String assignedTeamLabel;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "resolution_note", columnDefinition = "TEXT")
    private String resolutionNote;

    @Column(name = "resolution_photo_url", length = 500)
    private String resolutionPhotoUrl;

    // --- Champs IA existants ---
    @Column(name = "ai_severity_score")
    private Double aiSeverityScore;

    @Column(name = "ai_severity_label", length = 50)
    private String aiSeverityLabel;

    // --- Nouveaux champs IA : Cohérence, Gravité, Priorité, Doublons & Fallback ---
    @Column(name = "ai_status", length = 30)
    private String aiStatus = "PENDING_AI"; // PENDING_AI | VALIDATED | SPAM | DOUBLON | A_VERIFIER

    @Column(name = "ai_confidence")
    private Double aiConfidence;

    @Column(name = "ai_severity", length = 20)
    private String aiSeverity = "MOYENNE"; // FAIBLE | MOYENNE | URGENTE

    @Column(name = "ai_category_consistent")
    private Boolean aiCategoryConsistent = true;

    @Column(name = "ai_reason", length = 500)
    private String aiReason;

    @Column(name = "priority_score")
    private Integer priorityScore = 5;

    @Column(name = "duplicate_count")
    private Integer duplicateCount = 1;

    @Column(name = "parent_incident_id")
    private Long parentIncidentId;

    @Column(name = "ai_embedding", columnDefinition = "TEXT")
    private String aiEmbeddingJson;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "incident_voters", joinColumns = @JoinColumn(name = "incident_id"))
    @Column(name = "user_id")
    private Set<Long> voterIds = new HashSet<>();

    public Incident() {
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (aiStatus == null) {
            aiStatus = "PENDING_AI";
        }
        if (aiSeverity == null) {
            aiSeverity = "MOYENNE";
        }
        if (aiCategoryConsistent == null) {
            aiCategoryConsistent = true;
        }
        if (priorityScore == null) {
            priorityScore = 5;
        }
        if (duplicateCount == null) {
            duplicateCount = 1;
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public Integer getUpvotes() { return upvotes; }
    public void setUpvotes(Integer upvotes) { this.upvotes = upvotes; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getAssignedTeam() { return assignedTeam; }
    public void setAssignedTeam(String assignedTeam) { this.assignedTeam = assignedTeam; }

    public String getAssignedTeamLabel() { return assignedTeamLabel; }
    public void setAssignedTeamLabel(String assignedTeamLabel) { this.assignedTeamLabel = assignedTeamLabel; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getAssignedAt() { return assignedAt; }
    public void setAssignedAt(LocalDateTime assignedAt) { this.assignedAt = assignedAt; }

    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public String getResolutionNote() { return resolutionNote; }
    public void setResolutionNote(String resolutionNote) { this.resolutionNote = resolutionNote; }

    public String getResolutionPhotoUrl() { return resolutionPhotoUrl; }
    public void setResolutionPhotoUrl(String resolutionPhotoUrl) { this.resolutionPhotoUrl = resolutionPhotoUrl; }

    public Double getAiSeverityScore() { return aiSeverityScore; }
    public void setAiSeverityScore(Double aiSeverityScore) { this.aiSeverityScore = aiSeverityScore; }

    public String getAiSeverityLabel() { return aiSeverityLabel; }
    public void setAiSeverityLabel(String aiSeverityLabel) { this.aiSeverityLabel = aiSeverityLabel; }

    public String getAiStatus() { return aiStatus; }
    public void setAiStatus(String aiStatus) { this.aiStatus = aiStatus; }

    public Double getAiConfidence() { return aiConfidence; }
    public void setAiConfidence(Double aiConfidence) { this.aiConfidence = aiConfidence; }

    public String getAiSeverity() { return aiSeverity; }
    public void setAiSeverity(String aiSeverity) { this.aiSeverity = aiSeverity; }

    public Boolean getAiCategoryConsistent() { return aiCategoryConsistent; }
    public void setAiCategoryConsistent(Boolean aiCategoryConsistent) { this.aiCategoryConsistent = aiCategoryConsistent; }

    public String getAiReason() { return aiReason; }
    public void setAiReason(String aiReason) { this.aiReason = aiReason; }

    public Integer getPriorityScore() { return priorityScore; }
    public void setPriorityScore(Integer priorityScore) { this.priorityScore = priorityScore; }

    public Integer getDuplicateCount() { return duplicateCount; }
    public void setDuplicateCount(Integer duplicateCount) { this.duplicateCount = duplicateCount; }

    public Long getParentIncidentId() { return parentIncidentId; }
    public void setParentIncidentId(Long parentIncidentId) { this.parentIncidentId = parentIncidentId; }

    public String getAiEmbeddingJson() { return aiEmbeddingJson; }
    public void setAiEmbeddingJson(String aiEmbeddingJson) { this.aiEmbeddingJson = aiEmbeddingJson; }

    public Set<Long> getVoterIds() { return voterIds; }
    public void setVoterIds(Set<Long> voterIds) { this.voterIds = voterIds; }
}