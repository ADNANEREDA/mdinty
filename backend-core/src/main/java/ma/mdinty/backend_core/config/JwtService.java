package ma.mdinty.backend_core.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {

    // Clé secrète de 256 bits minimum pour signer les tokens HS256
    private static final String SECRET = "MdintyFesSmartCitySecretKey2026PourSignatureJWTSecurisee!";
    private final SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));

    // Durée de validité : 24 heures
    private static final long EXPIRATION_TIME = 86400000L;

    public String generateToken(String email, String role, Long userId) {
        return Jwts.builder()
                .subject(email)
                .claims(Map.of(
                        "role", role,
                        "userId", userId
                ))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME))
                .signWith(key)
                .compact();
    }

    public Claims extractClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}