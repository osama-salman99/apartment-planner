package work.osmosis.homeapp;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DesignRepository extends JpaRepository<DesignEntity, String> {

    /** Oldest first, so the list order is stable and a rename never reshuffles it. */
    List<DesignEntity> findAllByOrderByCreatedAtAsc();
}
