package ma.mdinty.backend_core.controller;

import ma.mdinty.backend_core.entity.Proposal;
import ma.mdinty.backend_core.repository.ProposalRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/proposals")
@CrossOrigin(origins = "http://localhost:4200")
public class ProposalController {

    private final ProposalRepository proposalRepository;

    public ProposalController(ProposalRepository proposalRepository) {
        this.proposalRepository = proposalRepository;
    }

    @GetMapping
    public List<Proposal> getAllProposals() {
        return proposalRepository.findAllByOrderByCreatedAtDesc();
    }

    @PostMapping
    public ResponseEntity<Proposal> createProposal(@RequestBody Proposal body) {
        Proposal proposal = new Proposal();
        proposal.setTitle(body.getTitle());
        proposal.setTheme(body.getTheme());
        proposal.setAddress(body.getAddress());
        proposal.setLatitude(body.getLatitude());
        proposal.setLongitude(body.getLongitude());
        proposal.setDescription(body.getDescription());
        proposal.setAuthorName(body.getAuthorName() != null ? body.getAuthorName() : "Citoyen Fès");
        proposal.setUserId(body.getUserId());
        proposal.setStatus("EN_EXAMEN");;

        if (body.getUserId() != null) {
            proposal.getVoterIds().add(body.getUserId());
            proposal.setVotes(1);
        } else {
            proposal.setVotes(body.getVotes() != null ? body.getVotes() : 1);
        }

        return ResponseEntity.ok(proposalRepository.save(proposal));
    }

    @PutMapping("/{id}/vote")
    public ResponseEntity<Proposal> toggleVote(
            @PathVariable Long id,
            @RequestParam(value = "userId", required = false) Long userId
    ) {
        return proposalRepository.findById(id)
                .map(proposal -> {
                    if (userId != null) {
                        if (proposal.getVoterIds().contains(userId)) {
                            proposal.getVoterIds().remove(userId);
                        } else {
                            proposal.getVoterIds().add(userId);
                        }
                        proposal.setVotes(proposal.getVoterIds().size());
                    } else {
                        int current = proposal.getVotes() != null ? proposal.getVotes() : 0;
                        proposal.setVotes(current + 1);
                    }
                    return ResponseEntity.ok(proposalRepository.save(proposal));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}