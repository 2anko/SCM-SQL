using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

// Read connection string from config (user-secrets / env / appsettings)
var connString = builder.Configuration.GetConnectionString("ScmDb")
    ?? throw new InvalidOperationException("Missing ConnectionStrings:ScmDb");

// Recommended in Npgsql: use a shared DataSource (pooling, performance)
builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(connString));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// 1) Quick “can I connect?” endpoint
app.MapGet("/db/health", async (NpgsqlDataSource ds) =>
{
    await using var conn = await ds.OpenConnectionAsync();
    await using var cmd = new NpgsqlCommand("SELECT 1;", conn);
    var result = await cmd.ExecuteScalarAsync();
    return Results.Ok(new { ok = (result?.ToString() == "1") });
});

// 2) First real endpoint: list customers
app.MapGet("/customers", async (NpgsqlDataSource ds) =>
{
    const string sql = """
        SELECT customer_id, company_name, address, phone, created_at
        FROM scm.customers
        ORDER BY customer_id
        LIMIT 100;
        """;

    await using var conn = await ds.OpenConnectionAsync();
    await using var cmd = new NpgsqlCommand(sql, conn);
    await using var reader = await cmd.ExecuteReaderAsync();

    var customers = new List<CustomerDto>();
    while (await reader.ReadAsync())
    {
        customers.Add(new CustomerDto(
            reader.GetInt64(0),
            reader.GetString(1),
            reader.IsDBNull(2) ? null : reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),
            reader.GetFieldValue<DateTimeOffset>(4)
        ));
    }

    return Results.Ok(customers);
});

app.MapGet("/db/whoami", async (NpgsqlDataSource ds) =>
{
    await using var conn = await ds.OpenConnectionAsync();
    await using var cmd = new NpgsqlCommand("SELECT current_user, current_database();", conn);
    await using var reader = await cmd.ExecuteReaderAsync();

    await reader.ReadAsync();
    return Results.Ok(new {
        user = reader.GetString(0),
        db = reader.GetString(1)
    });
});

app.Run();

record CustomerDto(long CustomerId, string CompanyName, string? Address, string? Phone, DateTimeOffset CreatedAt);
