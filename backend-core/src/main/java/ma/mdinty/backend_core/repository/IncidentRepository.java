package ma.mdinty.backend_core.repository;

import ma.mdinty.backend_core.entity.Incident;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {

    List<Incident> findAllByOrderByCreatedAtDesc();

    @Query(value = """
        SELECT * FROM incidents i
        WHERE i.id <> :incidentId
          AND i.parent_incident_id IS NULL
          AND i.ai_embedding IS NOT NULL
          AND i.latitude IS NOT NULL
          AND i.longitude IS NOT NULL
          AND i.created_at >= NOW() - INTERVAL '72 hours'
          AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(i.longitude, i.latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
              60.0
          )
        """, nativeQuery = true)
    List<Incident> findNearbyCandidates(
            @Param("incidentId") Long incidentId,
            @Param("lat") double lat,
            @Param("lon") double lon
    );
}