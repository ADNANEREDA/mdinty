package ma.mdinty.backend_core.controller;

import ma.mdinty.backend_core.config.JwtService;
import ma.mdinty.backend_core.entity.Role;
import ma.mdinty.backend_core.entity.User;
import ma.mdinty.backend_core.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:4200")
public class AuthController {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AuthController(UserRepository userRepository, JwtService jwtService) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");

        Optional<User> userOpt = userRepository.findByEmail(email);

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            boolean isPasswordValid = passwordEncoder.matches(password, user.getPassword())
                                      || user.getPassword().equals(password);

            if (isPasswordValid) {
                // Génération du token JWT signé contenant l'email, le rôle et l'ID
                String token = jwtService.generateToken(user.getEmail(), user.getRole().name(), user.getId());

                return ResponseEntity.ok(Map.of(
                        "token", token,
                        "id", user.getId(),
                        "nom", user.getNom(),
                        "prenom", user.getPrenom(),
                        "email", user.getEmail(),
                        "telephone", user.getTelephone(),
                        "role", user.getRole().name(),
                        "serviceName", user.getServiceName() != null ? user.getServiceName() : ""
                ));
            }
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", "Email ou mot de passe incorrect."));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User newUser) {
        if (userRepository.existsByEmail(newUser.getEmail())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Cet email est déjà utilisé."));
        }

        if (newUser.getRole() == null) {
            newUser.setRole(Role.CITOYEN);
        }

        newUser.setPassword(passwordEncoder.encode(newUser.getPassword()));
        User savedUser = userRepository.save(newUser);

        String token = jwtService.generateToken(savedUser.getEmail(), savedUser.getRole().name(), savedUser.getId());

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Compte citoyen créé avec succès !",
                "token", token,
                "id", savedUser.getId(),
                "email", savedUser.getEmail(),
                "role", savedUser.getRole().name()
        ));
    }
}