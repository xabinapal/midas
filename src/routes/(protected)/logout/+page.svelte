<script lang="ts">
	import { resolve } from "$app/paths";
</script>

<section class="hero min-h-[60vh]">
	<div class="hero-content">
		<div class="card max-w-md bg-base-200 shadow-xl">
			<div class="card-body text-center">
				<h1 class="card-title justify-center text-2xl">Log out?</h1>
				<p class="opacity-70">Your current browser session will end.</p>
				<div class="card-actions mt-4 justify-center">
					<a class="btn btn-ghost" href={resolve("/")}>Cancel</a>
					<form method="POST">
						<button class="btn btn-primary">Log out</button>
					</form>
				</div>
			</div>
		</div>
	</div>
</section>
