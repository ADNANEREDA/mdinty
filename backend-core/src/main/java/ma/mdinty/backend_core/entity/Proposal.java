package ma.mdinty.backend_core.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "proposals")
public class Proposal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String theme; // ECOLOGY, CULTURE, SPORT, MOBILITY

    @Column(nullable = false)
    private String address;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Column(nullable = false, length = 1500)
    private String description;

    @Column(name = "author_name", nullable = false)
    private String authorName;

    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private Integer votes = 1;

    @Column(nullable = false)
    private String status = "EN_EXAMEN"; // UNDER_REVIEW, PLANNED, APPROVED

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "proposal_voters", joinColumns = @JoinColumn(name = "proposal_id"))
    @Column(name = "user_id")
    private Set<Long> voterIds = new HashSet<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Proposal() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Integer getVotes() { return votes; }
    public void setVotes(Integer votes) { this.votes = votes; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Set<Long> getVoterIds() { return voterIds; }
    public void setVoterIds(Set<Long> voterIds) { this.voterIds = voterIds; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}