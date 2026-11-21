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
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "resolution_note", columnDefinition = "TEXT")
    private String resolutionNote;

    @Column(name = "resolution_photo_url", length = 500)
    private String resolutionPhotoUrl;

    @Column(name = "ai_severity_score")
    private Double aiSeverityScore;

    @Column(name = "ai_severity_label", length = 50)
    private String aiSeverityLabel;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "incident_voters", joinColumns = @JoinColumn(name = "incident_id"))
    @Column(name = "user_id")
    private Set<Long> voterIds = new HashSet<>();

    public Incident() {
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

    public Set<Long> getVoterIds() { return voterIds; }
    public void setVoterIds(Set<Long> voterIds) { this.voterIds = voterIds; }
}