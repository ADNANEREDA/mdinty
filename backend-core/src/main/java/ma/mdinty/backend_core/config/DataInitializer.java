package ma.mdinty.backend_core.config;

import ma.mdinty.backend_core.entity.Role;
import ma.mdinty.backend_core.entity.User;
import ma.mdinty.backend_core.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner initDatabase(UserRepository userRepository) {
        return args -> {
            if (userRepository.count() == 0) {
                userRepository.save(new User(
                        "Alami", "Hassan", "admin@fes.ma", "0661000001",
                        "password123", Role.ADMIN, "Direction Générale"
                ));
                userRepository.save(new User(
                        "Bennani", "Karim", "chef@fes.ma", "0661000002",
                        "password123", Role.CHEF_SERVICE, "Voirie et Éclairage"
                ));
                userRepository.save(new User(
                        "Tazi", "Youssef", "equipe@fes.ma", "0661000003",
                        "password123", Role.MEMBRE_EQUIPE, "Voirie et Éclairage"
                ));
                userRepository.save(new User(
                        "Idrissi", "Salma", "citoyen@fes.ma", "0661000004",
                        "password123", Role.CITOYEN, null
                ));
                System.out.println("✅ 4 comptes de test Mdinty créés avec succès dans PostgreSQL !");
            }
        };
    }
}