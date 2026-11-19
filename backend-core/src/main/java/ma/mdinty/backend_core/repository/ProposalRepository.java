package ma.mdinty.backend_core.repository;

import ma.mdinty.backend_core.entity.Proposal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProposalRepository extends JpaRepository<Proposal, Long> {
    List<Proposal> findAllByOrderByCreatedAtDesc();
}